import asyncio
import json
import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional
from pymongo import UpdateOne
from app.config.settings import settings
from app.database.connection import get_database, is_database_available
from app.schemas.paper import Paper
from app.services.arxiv_adapter import arxiv_adapter
from app.services.cache import cache_service
from app.services.deduplication import deduplicate_papers
from app.services.domain_service import domain_service
from app.services.openalex_adapter import openalex_adapter
from app.services.quality_service import quality_service
from app.services.semantic_scholar_adapter import semantic_scholar_adapter

logger = logging.getLogger("researchlens.paperservice")

LOCAL_CACHE_DIR = Path(__file__).resolve().parent.parent.parent / ".cache" / "domains"

LIMITATION_PATTERNS = [
    r"\bfuture (?:work|research|directions?|studies)\b",
    r"\bremains? (?:challenging|an open|open problems?|open questions?|largely unexplored)\b",
    r"\bopen (?:problem|challenge|question)s?\b",
    r"\b(?:has|have) not been (?:fully |adequately |yet )?(?:explored|addressed|studied|investigated)\b",
    r"\byet to be (?:explored|addressed|investigated|resolved)\b",
    r"\blimited by\b",
    r"\blimitations?\b",
    r"\black of (?:standardized|sufficient|real-world|comprehensive)\b",
    r"\bfew studies\b",
    r"\blittle attention\b",
    r"\bunderexplored\b",
    r"\bunexplored\b",
    r"\bfurther (?:investigation|research|exploration) is needed\b",
]


def extract_limitation_callout(abstract: Optional[str]) -> Optional[Dict[str, Any]]:
    """Extract explicit limitation / future work sentences and highlight key phrases."""
    if not abstract:
        return None

    sentences = re.split(r"(?<=[.!?])\s+", abstract.strip())
    combined_regex = re.compile("|".join(LIMITATION_PATTERNS), re.IGNORECASE)

    for sentence in sentences:
        match = combined_regex.search(sentence)
        if match:
            matched_phrase = match.group(0)
            highlighted_sentence = re.sub(
                f"(?i)({re.escape(matched_phrase)})",
                r"<strong>\1</strong>",
                sentence,
            )
            # Create highlighted abstract
            highlighted_abstract = abstract.replace(sentence, highlighted_sentence)
            return {
                "sentence": sentence,
                "matched_phrase": matched_phrase,
                "highlighted_sentence": highlighted_sentence,
                "highlighted_abstract": highlighted_abstract,
            }

    return None


class PaperService:
    """Orchestrates multi-source paper retrieval, quality ranking, filtering, and paper details."""

    def __init__(self):
        self.openalex = openalex_adapter
        self.semantic_scholar = semantic_scholar_adapter
        self.arxiv = arxiv_adapter

    async def search_papers(
        self,
        query: str,
        limit: int = 25,
        year_from: Optional[int] = None,
        year_to: Optional[int] = None,
    ) -> List[Paper]:
        """Queries OpenAlex, Semantic Scholar, and arXiv concurrently and deduplicates results."""
        cache_key = {
            "query": query.strip().lower(),
            "limit": limit,
            "year_from": year_from,
            "year_to": year_to,
        }
        cached = await cache_service.get("search_papers", cache_key)
        if cached is not None:
            logger.info("Serving query '%s' from search cache (%d papers)", query, len(cached))
            return [Paper(**p) for p in cached]

        per_source_limit = max(10, limit)
        results = await asyncio.gather(
            self.openalex.search_papers(
                query=query,
                limit=per_source_limit,
                year_from=year_from,
                year_to=year_to,
            ),
            self.semantic_scholar.search_papers(
                query=query,
                limit=per_source_limit,
            ),
            self.arxiv.search_papers(
                query=query,
                limit=per_source_limit,
            ),
            return_exceptions=True,
        )

        all_papers: List[Paper] = []
        for res in results:
            if isinstance(res, list):
                all_papers.extend(res)
            elif isinstance(res, Exception):
                logger.warning("A paper source raised an exception: %s", res)

        deduped = deduplicate_papers(all_papers)
        deduped.sort(key=lambda p: (p.citation_count, p.year or 0), reverse=True)

        final_papers = deduped[:limit]

        await cache_service.set(
            "search_papers",
            cache_key,
            [p.model_dump() for p in final_papers],
        )

        return final_papers

    async def get_domain_papers(
        self,
        domain_id: str,
        year_from: Optional[int] = None,
        year_to: Optional[int] = None,
        venue_tier: Optional[str] = None,
        institution_group: Optional[str] = None,
        top_only: bool = False,
        min_citations: int = 0,
        open_access_only: bool = False,
        paper_type: Optional[str] = None,
        sort: str = "quality",
        page: int = 1,
        limit: int = 20,
    ) -> Dict[str, Any]:
        """Retrieves and filters quality-scored papers for a research domain."""
        domain = domain_service.get_domain(domain_id)
        if not domain:
            return {"total": 0, "page": page, "limit": limit, "pages": 0, "papers": []}

        # Check local domain papers cache
        local_cache_file = LOCAL_CACHE_DIR / f"{domain_id}_papers.json"
        papers: List[Paper] = []

        if local_cache_file.exists():
            try:
                with open(local_cache_file, "r", encoding="utf-8") as f:
                    cached_data = json.load(f)
                    papers = [Paper(**p) for p in cached_data]
            except Exception as exc:
                logger.debug("Failed reading domain papers cache: %s", exc)

        # If not cached, fetch initial corpus (100 papers)
        if not papers:
            # Query domain name and top sub-areas
            search_terms = [domain.name] + [t.name for t in domain.topics[:3]]
            collected: List[Paper] = []

            for term in search_terms:
                batch = await self.search_papers(term, limit=30)
                collected.extend(batch)

            papers = deduplicate_papers(collected)

            # Save in local cache
            try:
                LOCAL_CACHE_DIR.mkdir(parents=True, exist_ok=True)
                with open(local_cache_file, "w", encoding="utf-8") as f:
                    json.dump([p.model_dump() for p in papers], f, default=str)
            except Exception as exc:
                logger.debug("Failed writing domain papers cache: %s", exc)

            # Save in MongoDB papers collection if available
            if is_database_available():
                try:
                    db = get_database()
                    coll = db["papers"]
                    bulk_ops = [
                        UpdateOne(
                            {"id": p.id},
                            {"$set": p.model_dump()},
                            upsert=True,
                        )
                        for p in papers
                    ]
                    if bulk_ops:
                        coll.bulk_write(bulk_ops, ordered=False)
                except Exception as exc:
                    logger.debug("Failed saving papers to MongoDB: %s", exc)

        # Evaluate quality scores and enrich metadata
        enriched_papers: List[Dict[str, Any]] = []
        for p in papers:
            eval_data = quality_service.evaluate_paper(p)
            limitation = extract_limitation_callout(p.abstract)

            item = p.model_dump()
            item["quality"] = eval_data
            item["limitation_callout"] = limitation
            enriched_papers.append(item)

        # Apply Filtering
        filtered = []
        for item in enriched_papers:
            p_year = item.get("year")
            if year_from and (p_year is None or p_year < year_from):
                continue
            if year_to and (p_year is None or p_year > year_to):
                continue
            if min_citations and (item.get("citation_count", 0) < min_citations):
                continue
            if open_access_only and not item.get("is_open_access"):
                continue
            if paper_type and item.get("type", "").lower() != paper_type.lower():
                continue

            q = item["quality"]
            if venue_tier and venue_tier.lower() != "all" and q["venue_tier"] != venue_tier.lower():
                continue
            if (
                institution_group
                and institution_group.lower() != "all"
                and q["institution_group"] != institution_group.lower()
            ):
                continue
            if top_only and not (q["is_top_venue"] or q["is_top_institution"]):
                continue

            filtered.append(item)

        # Apply Sorting
        if sort == "quality":
            filtered.sort(
                key=lambda x: (x["quality"]["quality_score"], x.get("citation_count", 0)),
                reverse=True,
            )
        elif sort == "citations":
            filtered.sort(
                key=lambda x: (x.get("citation_count", 0), x["quality"]["quality_score"]),
                reverse=True,
            )
        elif sort == "recency":
            filtered.sort(
                key=lambda x: (x.get("year") or 0, x.get("citation_count", 0)),
                reverse=True,
            )

        # Pagination
        total = len(filtered)
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_papers = filtered[start_idx:end_idx]
        total_pages = (total + limit - 1) // limit if limit > 0 else 1

        return {
            "total": total,
            "page": page,
            "limit": limit,
            "pages": total_pages,
            "papers": paginated_papers,
        }

    async def get_paper_detail(self, paper_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves comprehensive details for a single paper with limitation callouts."""
        paper: Optional[Paper] = None

        # 1. Check in MongoDB
        if is_database_available():
            try:
                db = get_database()
                doc = db["papers"].find_one({"id": paper_id})
                if doc:
                    doc.pop("_id", None)
                    paper = Paper(**doc)
            except Exception as exc:
                logger.debug("Failed querying paper from MongoDB: %s", exc)

        # 2. Check local caches
        if not paper:
            for cache_file in LOCAL_CACHE_DIR.glob("*_papers.json"):
                try:
                    with open(cache_file, "r", encoding="utf-8") as f:
                        papers_list = json.load(f)
                        for p_dict in papers_list:
                            if p_dict.get("id") == paper_id:
                                paper = Paper(**p_dict)
                                break
                    if paper:
                        break
                except Exception:
                    pass

        # 3. If not found locally, fetch live by ID
        if not paper:
            if paper_id.startswith("openalex:"):
                raw_id = paper_id.replace("openalex:", "")
                url = f"{settings.OPENALEX_BASE_URL.rstrip('/')}/works/{raw_id}"
                try:
                    from app.services.http_client import http_client
                    res = await http_client.get(url)
                    paper = self.openalex._normalize_work(res.json())
                except Exception as exc:
                    logger.debug("Could not fetch paper by OpenAlex ID: %s", exc)

        if not paper:
            return None

        eval_data = quality_service.evaluate_paper(paper)
        limitation = extract_limitation_callout(paper.abstract)

        res = paper.model_dump()
        res["quality"] = eval_data
        res["limitation_callout"] = limitation
        return res


paper_service = PaperService()
