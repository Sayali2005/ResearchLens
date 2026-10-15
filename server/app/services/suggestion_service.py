import json
import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional
from app.schemas.insight import PaperSummary, RoadmapStage, SuggestionCard, SuggestionsResponse
from app.schemas.paper import Paper
from app.services.challenge_service import challenge_service
from app.services.domain_service import domain_service
from app.services.gap_service import gap_service
from app.services.quality_service import quality_service

logger = logging.getLogger("researchlens.suggestionservice")

LOCAL_CACHE_DIR = Path(__file__).resolve().parent.parent.parent / ".cache" / "domains"

DISCLAIMER_TEXT = (
    "Gaps are candidates based on publication counts and keyword co-occurrence models. "
    "A low count can signify an unpromising or impractical niche as well as a genuine open research opportunity. "
    "Carefully review the linked papers and problem constraints before finalizing your research direction."
)


class SuggestionService:
    """Generates candidate project directions, evidence cards, and 3-stage reading roadmaps."""

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

    async def generate_suggestions_and_roadmap(self, domain_id: str) -> Optional[SuggestionsResponse]:
        """Synthesizes top gap opportunities into direction cards and generates reading roadmap."""
        domain = domain_service.get_domain(domain_id)
        if not domain:
            return None

        # Check local cache
        cache_file = LOCAL_CACHE_DIR / f"{domain_id}_suggestions.json"
        if cache_file.exists():
            try:
                with open(cache_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return SuggestionsResponse(**data)
            except Exception as exc:
                logger.debug("Failed reading suggestions cache: %s", exc)

        # 1. Fetch Gap Matrix & Trends
        matrix = await gap_service.compute_gap_matrix(domain_id)
        trends = domain_service.get_domain_trends(domain_id)
        trend_map = {t.topic_id: t.label for t in trends} if trends else {}

        # 2. Load Papers and Challenges
        papers = self._load_domain_papers(domain_id)
        challenges_resp = challenge_service.extract_domain_challenges(domain_id)
        all_challenges = challenges_resp.challenges if challenges_resp else []

        # Build application keywords map from gap service
        app_map = {a.id: a.model_dump() for a in gap_service.get_applications()}

        # 3. Build Top Opportunity Cards
        top_cells = matrix.top_opportunities[:6] if matrix else []
        suggestions: List[SuggestionCard] = []

        for idx, cell in enumerate(top_cells):
            app_meta = app_map.get(cell.application_id, {})
            app_keywords = app_meta.get("keywords", [cell.application_name.lower()])

            # Find matching example papers
            matching_papers: List[Paper] = []
            for p in papers:
                text = f"{p.title or ''} {p.abstract or ''}".lower()
                topic_words = cell.topic_name.lower().split()
                has_topic = any(w in text for w in topic_words if len(w) > 3)
                has_app = any(k.lower() in text for k in app_keywords)

                if has_topic and has_app:
                    matching_papers.append(p)

            # If fewer than 2 matched both, backfill with top papers mentioning application or topic
            if len(matching_papers) < 2:
                for p in papers:
                    if p not in matching_papers:
                        text = f"{p.title or ''} {p.abstract or ''}".lower()
                        if any(k.lower() in text for k in app_keywords):
                            matching_papers.append(p)
                    if len(matching_papers) >= 3:
                        break

            # If still needed, fill with top domain papers
            for p in papers:
                if len(matching_papers) >= 3:
                    break
                if p not in matching_papers:
                    matching_papers.append(p)

            example_summaries = []
            for p in matching_papers[:3]:
                authors = [a.name for a in p.authors[:3]] if p.authors else []
                example_summaries.append(
                    PaperSummary(
                        id=p.id,
                        title=p.title,
                        year=p.year,
                        venue=p.venue,
                        citation_count=p.citation_count,
                        authors=authors,
                        landing_url=p.landing_url,
                        pdf_url=p.pdf_url,
                        is_open_access=p.is_open_access,
                    )
                )

            # Find related open challenge sentences
            rel_challenges: List[str] = []
            for c in all_challenges:
                c_text = c.sentence.lower()
                if any(k.lower() in c_text for k in app_keywords) or any(
                    w.lower() in c_text for w in cell.topic_name.split() if len(w) > 4
                ):
                    rel_challenges.append(c.sentence)
                    if len(rel_challenges) >= 2:
                        break

            trend_label = trend_map.get(cell.topic_id, "Stable")
            why_text = (
                f"Observed {cell.observed} publications vs. {cell.expected:.1f} expected "
                f"(observed-to-expected ratio {cell.ratio:.2f}). Sub-area '{cell.topic_name}' "
                f"is currently classified as {trend_label}. High opportunity score of {cell.opportunity:.2f}."
            )

            matched_keywords = list(set(app_keywords[:3] + [w for w in cell.topic_name.split() if len(w) > 3]))

            suggestions.append(
                SuggestionCard(
                    id=f"sugg_{domain_id[:6]}_{idx+1}",
                    title=f"{cell.topic_name} in {cell.application_name}",
                    sub_area=cell.topic_name,
                    sub_area_id=cell.topic_id,
                    application=cell.application_name,
                    application_id=cell.application_id,
                    why=why_text,
                    observed=cell.observed,
                    expected=cell.expected,
                    ratio=cell.ratio,
                    opportunity=cell.opportunity,
                    sub_area_trend=trend_label,
                    keywords=matched_keywords,
                    example_papers=example_summaries,
                    related_challenges=rel_challenges,
                )
            )

        # 4. Build 3-Stage Ordered Reading Roadmap
        # Stage 1: Recent Surveys & Overview papers
        survey_papers: List[Paper] = []
        for p in papers:
            is_survey = (p.type and p.type.lower() == "review") or bool(
                re.search(r"\b(?:survey|review|overview|advances in|progress in|roadmap)\b", (p.title or "").lower())
            )
            if is_survey:
                survey_papers.append(p)

        survey_papers.sort(key=lambda p: (p.year or 0, p.citation_count), reverse=True)
        stage_1_papers = survey_papers[:4]
        # Only if no surveys exist at all in the corpus, select top overview paper
        if not stage_1_papers and papers:
            stage_1_papers = sorted(papers, key=lambda x: x.citation_count, reverse=True)[:1]

        # Stage 2: Milestone & Foundational Works (seminal papers, high citations)
        seminal_candidates = [p for p in papers if p not in stage_1_papers]
        seminal_candidates.sort(key=lambda p: p.citation_count, reverse=True)
        stage_2_papers = seminal_candidates[:4]

        # Stage 3: State-of-the-Art & Recent Advances (last 24 months, high quality)
        recent_candidates = [
            p for p in papers
            if p not in stage_1_papers and p not in stage_2_papers and (p.year or 0) >= 2024
        ]
        recent_candidates.sort(
            key=lambda p: (quality_service.evaluate_paper(p)["quality_score"], p.citation_count),
            reverse=True,
        )
        stage_3_papers = recent_candidates[:4]
        if not stage_3_papers:
            remaining = [p for p in papers if p not in stage_1_papers and p not in stage_2_papers]
            remaining.sort(key=lambda p: p.year or 0, reverse=True)
            stage_3_papers = remaining[:4]

        def to_summaries(plist: List[Paper]) -> List[PaperSummary]:
            res = []
            for p in plist:
                authors = [a.name for a in p.authors[:3]] if p.authors else []
                res.append(
                    PaperSummary(
                        id=p.id,
                        title=p.title,
                        year=p.year,
                        venue=p.venue,
                        citation_count=p.citation_count,
                        authors=authors,
                        landing_url=p.landing_url,
                        pdf_url=p.pdf_url,
                        is_open_access=p.is_open_access,
                    )
                )
            return res

        roadmap = [
            RoadmapStage(
                stage=1,
                title="Foundational Surveys & Landscape",
                description="Comprehensive survey and review papers establishing problem taxonomy, benchmark datasets, and architectural foundations.",
                papers=to_summaries(stage_1_papers),
            ),
            RoadmapStage(
                stage=2,
                title="Milestone & Foundational Works",
                description="High-impact seminal publications and foundational architectures that established key paradigms and state-of-the-art baselines.",
                papers=to_summaries(stage_2_papers),
            ),
            RoadmapStage(
                stage=3,
                title="State-of-the-Art & Recent Advances",
                description="Recent high-rigor publications addressing contemporary limitations, computational efficiency, and emergent real-world frontiers.",
                papers=to_summaries(stage_3_papers),
            ),
        ]

        response = SuggestionsResponse(
            domain_id=domain_id,
            disclaimer=DISCLAIMER_TEXT,
            suggestions=suggestions,
            roadmap=roadmap,
        )

        # Save to local cache
        try:
            LOCAL_CACHE_DIR.mkdir(parents=True, exist_ok=True)
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(response.model_dump(), f, indent=2)
        except Exception as exc:
            logger.debug("Failed saving suggestions cache: %s", exc)

        return response


suggestion_service = SuggestionService()
