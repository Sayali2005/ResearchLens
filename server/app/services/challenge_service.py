import hashlib
import json
import logging
import math
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Set
from app.database.connection import get_database, is_database_available
from app.schemas.insight import ChallengeItem, ChallengesResponse, PaperSummary
from app.schemas.paper import Paper
from app.services.domain_service import domain_service

logger = logging.getLogger("researchlens.challengeservice")

LOCAL_CACHE_DIR = Path(__file__).resolve().parent.parent.parent / ".cache" / "domains"

# Graded pattern regexes with distinct weights
TIER_1_PATTERNS = [
    r"\bremains? (?:an open|a major|a key) (?:problem|challenge|question|issue)s?\b",
    r"\bremains? (?:significantly |largely |highly )?challenging\b",
    r"\bopen (?:problem|challenge|question)s?\b",
    r"\bfuture directions?\b",
    r"\bfuture research (?:should|needs to|is needed|directions)\b",
    r"\b(?:largely |remains )?underexplored\b",
    r"\bunexplored (?:area|domain|territory|direction|questions?)\b",
    r"\blittle attention has been (?:paid|given)\b",
    r"\byet to be (?:fully |adequately |properly )?(?:explored|addressed|investigated|resolved)\b",
]

TIER_2_PATTERNS = [
    r"\bfuture (?:work|studies|investigations?)\b",
    r"\bfurther (?:investigation|research|exploration|analysis) is (?:warranted|needed|required)\b",
    r"\blimited by\b",
    r"\bmain limitation[s]? of\b",
    r"\bsevere limitation[s]?\b",
    r"\black of (?:standardized|sufficient|real-world|labeled|annotated|comprehensive)\b",
    r"\bfew studies (?:have|focus on)\b",
    r"\b(?:has|have) not been (?:fully |adequately |extensively )?(?:explored|addressed|studied|investigated)\b",
]

TIER_3_PATTERNS = [
    r"\blimitations?\b",
    r"\bhas not been\b",
    r"\bhave not been\b",
    r"\byet to be\b",
    r"\bremains difficult\b",
]

CATEGORY_RULES = [
    (
        "Scalability & Efficiency",
        re.compile(r"\b(?:scalab\w+|latenc\w+|comput\w+|efficien\w+|throughput|overhead|memory|real-time|compact|resource)\b", re.I),
    ),
    (
        "Generalization & Robustness",
        re.compile(r"\b(?:robust\w+|generaliz\w+|out-of-distribution|domain shift|adversarial|drift|edge case|noisy)\b", re.I),
    ),
    (
        "Data Scarcity & Quality",
        re.compile(r"\b(?:annotat\w+|label\w+|scarc\w+|few-shot|small sample|benchmark|imbalance|missing data|ground truth)\b", re.I),
    ),
    (
        "Interpretability & Trust",
        re.compile(r"\b(?:interpret\w+|explainab\w+|transparen\w+|trust\w+|fairness|bias|safety|hallucinat\w+|verifi\w+)\b", re.I),
    ),
    (
        "Real-World Deployment",
        re.compile(r"\b(?:deploy\w+|hardware|clinical|field|edge device|practical|industry|regulat\w+|wearable)\b", re.I),
    ),
]


class ChallengeService:
    """Extracts, ranks, and deduplicates research challenges and limitations from paper abstracts."""

    def __init__(self):
        self.tier1_re = re.compile("|".join(TIER_1_PATTERNS), re.IGNORECASE)
        self.tier2_re = re.compile("|".join(TIER_2_PATTERNS), re.IGNORECASE)
        self.tier3_re = re.compile("|".join(TIER_3_PATTERNS), re.IGNORECASE)

    def _load_domain_papers(self, domain_id: str) -> List[Paper]:
        cache_file = LOCAL_CACHE_DIR / f"{domain_id}_papers.json"
        if cache_file.exists():
            try:
                with open(cache_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return [Paper(**p) for p in data]
            except Exception as exc:
                logger.debug("Failed reading papers cache for %s: %s", domain_id, exc)
        return []

    def _is_survey_paper(self, paper: Paper) -> bool:
        if paper.type and paper.type.lower() == "review":
            return True
        title = (paper.title or "").lower()
        return bool(re.search(r"\b(?:survey|review|overview|advances in|progress in|landscape of|roadmap)\b", title))

    def _categorize_sentence(self, sentence: str) -> str:
        for cat_name, cat_re in CATEGORY_RULES:
            if cat_re.search(sentence):
                return cat_name
        return "Methodological Bottlenecks"

    def _token_jaccard(self, s1: str, s2: str) -> float:
        stop_words = {"the", "a", "an", "in", "on", "of", "and", "or", "for", "with", "to", "at", "by", "is", "are"}
        tokens1 = {w.lower() for w in re.findall(r"\b\w{3,}\b", s1) if w.lower() not in stop_words}
        tokens2 = {w.lower() for w in re.findall(r"\b\w{3,}\b", s2) if w.lower() not in stop_words}
        if not tokens1 or not tokens2:
            return 0.0
        return len(tokens1 & tokens2) / len(tokens1 | tokens2)

    def extract_domain_challenges(self, domain_id: str) -> Optional[ChallengesResponse]:
        """Extracts open challenge sentences, ranks them by pattern strength and citations, and attaches sources."""
        domain = domain_service.get_domain(domain_id)
        if not domain:
            return None

        # Check local cache
        cache_file = LOCAL_CACHE_DIR / f"{domain_id}_challenges.json"
        if cache_file.exists():
            try:
                with open(cache_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return ChallengesResponse(**data)
            except Exception as exc:
                logger.debug("Failed reading challenges cache: %s", exc)

        papers = self._load_domain_papers(domain_id)
        if not papers:
            return ChallengesResponse(
                domain_id=domain_id,
                total_challenges=0,
                challenges=[],
            )

        extracted_candidates: List[Dict[str, Any]] = []

        for p in papers:
            abstract = (p.abstract or "").strip()
            if not abstract or len(abstract) < 40:
                continue

            is_survey = self._is_survey_paper(p)
            citations = p.citation_count or 0
            year = p.year or 2024

            # Sentence splitting
            sentences = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9])", abstract)

            for sentence in sentences:
                clean_s = sentence.strip()
                if len(clean_s) < 25 or len(clean_s) > 400:
                    continue

                # Match against tiers
                match = self.tier1_re.search(clean_s)
                pattern_weight = 3.0
                if not match:
                    match = self.tier2_re.search(clean_s)
                    pattern_weight = 2.0
                if not match:
                    match = self.tier3_re.search(clean_s)
                    pattern_weight = 1.0

                if match:
                    matched_phrase = match.group(0)

                    # Highlight matched phrase
                    highlighted = re.sub(
                        f"(?i)({re.escape(matched_phrase)})",
                        r"<strong>\1</strong>",
                        clean_s,
                    )

                    # Compute score
                    log_cits = math.log10(max(1, citations) + 1)
                    survey_multiplier = 1.5 if is_survey else 1.0
                    recency_bonus = 0.5 if year >= 2023 else 0.0

                    final_score = round(
                        (pattern_weight * 2.5 + log_cits * 1.5 + recency_bonus) * survey_multiplier,
                        2,
                    )

                    category = self._categorize_sentence(clean_s)

                    author_names = [a.name for a in p.authors[:3]] if p.authors else []
                    paper_summary = PaperSummary(
                        id=p.id,
                        title=p.title,
                        year=p.year,
                        venue=p.venue,
                        citation_count=p.citation_count,
                        authors=author_names,
                        landing_url=p.landing_url,
                        pdf_url=p.pdf_url,
                        is_open_access=p.is_open_access,
                        is_review=is_survey,
                    )

                    sentence_hash = hashlib.md5(clean_s.lower().encode("utf-8")).hexdigest()[:10]
                    challenge_id = f"chal_{domain_id[:6]}_{sentence_hash}"

                    extracted_candidates.append({
                        "id": challenge_id,
                        "sentence": clean_s,
                        "highlighted_sentence": highlighted,
                        "pattern": matched_phrase,
                        "category": category,
                        "score": final_score,
                        "source_paper": paper_summary,
                    })

        # Sort candidate challenges by score descending
        extracted_candidates.sort(key=lambda x: x["score"], reverse=True)

        # Deduplicate near-duplicates by token overlap
        deduped: List[ChallengeItem] = []
        for cand in extracted_candidates:
            is_dup = False
            for existing in deduped:
                if self._token_jaccard(cand["sentence"], existing.sentence) > 0.50:
                    is_dup = True
                    break
            if not is_dup:
                deduped.append(ChallengeItem(**cand))
            if len(deduped) >= 30:
                break

        response = ChallengesResponse(
            domain_id=domain_id,
            total_challenges=len(deduped),
            challenges=deduped,
        )

        # Save to local cache
        try:
            LOCAL_CACHE_DIR.mkdir(parents=True, exist_ok=True)
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(response.model_dump(), f, indent=2)
        except Exception as exc:
            logger.debug("Failed saving challenges cache: %s", exc)

        # Save to MongoDB challenges collection if available
        if is_database_available():
            try:
                db = get_database()
                coll = db["challenges"]
                for c in deduped:
                    coll.update_one(
                        {"id": c.id},
                        {
                            "$set": {
                                "id": c.id,
                                "domain_id": domain_id,
                                "sentence": c.sentence,
                                "pattern": c.pattern,
                                "source_paper_id": c.source_paper.id,
                                "score": c.score,
                                "category": c.category,
                            }
                        },
                        upsert=True,
                    )
            except Exception as exc:
                logger.debug("Failed saving challenges to MongoDB: %s", exc)

        return response


challenge_service = ChallengeService()
