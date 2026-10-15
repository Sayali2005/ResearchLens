import json
import logging
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from app.schemas.paper import Author, Paper

logger = logging.getLogger("researchlens.quality")

INSTITUTIONS_PATH = Path(__file__).resolve().parent.parent.parent / "config" / "institutions.json"
VENUES_PATH = Path(__file__).resolve().parent.parent.parent / "config" / "venues.json"


class QualityService:
    """Computes transparent, multi-factor academic quality scores for research papers."""

    def __init__(self):
        self._institutions: Dict[str, Any] = {}
        self._venues: Dict[str, Any] = {}
        self._load_configs()

    def _load_configs(self):
        if INSTITUTIONS_PATH.exists():
            try:
                with open(INSTITUTIONS_PATH, "r", encoding="utf-8") as f:
                    self._institutions = json.load(f)
            except Exception as exc:
                logger.warning("Failed reading institutions.json: %s", exc)

        if VENUES_PATH.exists():
            try:
                with open(VENUES_PATH, "r", encoding="utf-8") as f:
                    self._venues = json.load(f)
            except Exception as exc:
                logger.warning("Failed reading venues.json: %s", exc)

    def get_venue_evaluation(self, venue: Optional[str]) -> Tuple[str, float]:
        if not venue:
            return "unknown", 0.25

        v_lower = venue.lower().strip()

        # Check Tier 1
        tier_1 = self._venues.get("tier_1", {})
        for pat in tier_1.get("patterns", []):
            if pat in v_lower:
                return "tier_1", float(tier_1.get("score", 1.0))

        # Check Tier 2
        tier_2 = self._venues.get("tier_2", {})
        for pat in tier_2.get("patterns", []):
            if pat in v_lower:
                return "tier_2", float(tier_2.get("score", 0.75))

        # Check Tier 3
        tier_3 = self._venues.get("tier_3", {})
        for pat in tier_3.get("patterns", []):
            if pat in v_lower:
                return "tier_3", float(tier_3.get("score", 0.50))

        # Check Preprint
        preprints = self._venues.get("preprint", {})
        for pat in preprints.get("patterns", []):
            if pat in v_lower:
                return "preprint", float(preprints.get("score", 0.35))

        return "other", float(self._venues.get("default_score", 0.25))

    def get_institution_evaluation(self, authors: List[Author]) -> Tuple[str, float]:
        if not authors:
            return "other", 0.25

        best_group = "other"
        best_score = float(self._institutions.get("default_score", 0.25))

        group_a = self._institutions.get("group_a", {})
        group_c = self._institutions.get("group_c", {})
        group_b = self._institutions.get("group_b", {})

        for author in authors:
            for inst in author.institutions:
                name_lower = (inst.name or "").lower()
                ror_str = (inst.ror or "").lower()

                # Check Group A
                if any(ror in ror_str for ror in group_a.get("rors", [])) or any(
                    kw in name_lower for kw in group_a.get("keywords", [])
                ):
                    return "group_a", float(group_a.get("score", 1.0))

                # Check Group C (Industry labs)
                if any(ror in ror_str for ror in group_c.get("rors", [])) or any(
                    kw in name_lower for kw in group_c.get("keywords", [])
                ):
                    if best_score < float(group_c.get("score", 0.95)):
                        best_group, best_score = "group_c", float(group_c.get("score", 0.95))

                # Check Group B (Premier Indian)
                if any(ror in ror_str for ror in group_b.get("rors", [])) or any(
                    kw in name_lower for kw in group_b.get("keywords", [])
                ):
                    if best_score < float(group_b.get("score", 0.90)):
                        best_group, best_score = "group_b", float(group_b.get("score", 0.90))

        return best_group, best_score

    def get_citation_score(self, citation_count: int, year: Optional[int], current_year: int) -> float:
        paper_year = year or current_year
        age = max(1, current_year - paper_year)
        annual_citations = citation_count / age
        # Scaled 0 to 1 log scale
        scaled = math.log1p(annual_citations) / math.log1p(50)
        return round(min(1.0, max(0.0, scaled)), 4)

    def evaluate_paper(self, paper: Paper) -> Dict[str, Any]:
        current_year = datetime.now(timezone.utc).year
        venue_tier, venue_score = self.get_venue_evaluation(paper.venue)
        inst_group, inst_score = self.get_institution_evaluation(paper.authors)

        # Papers from last 24 months (year >= current_year - 1)
        paper_year = paper.year or current_year
        is_recent = paper_year >= (current_year - 1)

        cit_score = self.get_citation_score(paper.citation_count, paper.year, current_year)

        if is_recent:
            # For recent papers: citations are unreliable -> 0.50*venue + 0.50*inst + recency boost
            recency_boost = 0.10 if paper_year == current_year else 0.05
            base_score = 0.50 * venue_score + 0.50 * inst_score
            quality = min(1.0, base_score + recency_boost)
        else:
            # Standard score: 0.35*venue + 0.25*inst + 0.40*citations
            quality = 0.35 * venue_score + 0.25 * inst_score + 0.40 * cit_score

        return {
            "quality_score": round(quality, 4),
            "venue_tier": venue_tier,
            "venue_score": venue_score,
            "institution_group": inst_group,
            "institution_score": inst_score,
            "citation_score": cit_score,
            "is_recent": is_recent,
            "is_top_venue": venue_tier in ["tier_1", "tier_2"],
            "is_top_institution": inst_group in ["group_a", "group_b", "group_c"],
        }


quality_service = QualityService()
