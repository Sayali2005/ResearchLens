import logging
from typing import Any, Dict, List, Optional
from app.config.settings import settings
from app.schemas.paper import Author, Paper
from app.services.cache import cache_service
from app.services.http_client import http_client

logger = logging.getLogger("researchlens.semanticscholar")


class SemanticScholarAdapter:
    """Adapter for querying and normalizing papers from Semantic Scholar Graph API."""

    def __init__(self):
        self.base_url = settings.SEMANTIC_SCHOLAR_API_URL.rstrip("/")

    def _normalize_paper(self, item: Dict[str, Any]) -> Paper:
        paper_id = item.get("paperId") or ""
        title = item.get("title") or "Untitled"
        abstract = item.get("abstract")
        year = item.get("year")
        pub_date = item.get("publicationDate")
        venue = item.get("venue")

        external_ids = item.get("externalIds") or {}
        doi = external_ids.get("DOI")
        arxiv_id = external_ids.get("ArXiv")

        # Open Access info
        oa_pdf = item.get("openAccessPdf") or {}
        pdf_url = oa_pdf.get("url")
        is_oa = bool(item.get("isOpenAccess") or pdf_url)

        # Citations
        citations = item.get("citationCount", 0) or 0
        influential_citations = item.get("influentialCitationCount", 0) or 0

        # Authors
        authors: List[Author] = []
        for a in item.get("authors", []):
            authors.append(
                Author(
                    name=a.get("name") or "Unknown",
                    id=a.get("authorId"),
                    institutions=[],
                )
            )

        # Fields of study / topics
        topics = item.get("fieldsOfStudy") or []
        if not isinstance(topics, list):
            topics = []

        # Publication types / paper type
        pub_types = [t.lower() for t in (item.get("publicationTypes") or []) if isinstance(t, str)]
        if "review" in pub_types:
            paper_type = "review"
        elif "preprint" in pub_types or arxiv_id:
            paper_type = "preprint"
        else:
            paper_type = "article"

        return Paper(
            id=f"s2:{paper_id}",
            doi=doi,
            arxiv_id=arxiv_id,
            title=title,
            abstract=abstract,
            year=year,
            publication_date=pub_date,
            venue=venue,
            venue_type="journal" if venue else None,
            authors=authors,
            citation_count=citations,
            influential_citation_count=influential_citations,
            is_open_access=is_oa,
            pdf_url=pdf_url,
            landing_url=item.get("url"),
            topics=topics,
            type=paper_type,
            source="semantic_scholar",
        )

    async def search_papers(
        self,
        query: str,
        limit: int = 25,
        year: Optional[str] = None,
    ) -> List[Paper]:
        """Search papers from Semantic Scholar Graph API."""
        cache_key = {
            "source": "semantic_scholar",
            "query": query,
            "limit": limit,
            "year": year,
        }
        cached = await cache_service.get("papers", cache_key)
        if cached is not None:
            return [Paper(**p) for p in cached]

        url = f"{self.base_url}/paper/search"
        params: Dict[str, Any] = {
            "query": query,
            "limit": min(limit, 100),
            "fields": (
                "paperId,"
                "title,"
                "abstract,"
                "year,"
                "citationCount,"
                "influentialCitationCount,"
                "authors,"
                "venue,"
                "publicationDate,"
                "externalIds,"
                "url,"
                "isOpenAccess,"
                "openAccessPdf,"
                "fieldsOfStudy,"
                "publicationTypes"
            ),
        }
        if year:
            params["year"] = year

        try:
            response = await http_client.get(url, params=params)
            data = response.json()
            raw_items = data.get("data", [])
            papers = [self._normalize_paper(item) for item in raw_items]

            await cache_service.set(
                "papers",
                cache_key,
                [p.model_dump() for p in papers],
            )
            return papers
        except Exception as exc:
            logger.warning("Semantic Scholar search failed: %s", exc)
            return []


semantic_scholar_adapter = SemanticScholarAdapter()
