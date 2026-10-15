import json
import logging
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional
from sklearn.feature_extraction.text import TfidfVectorizer
from app.database.connection import get_database, is_database_available
from app.schemas.insight import DatasetItem, KeywordItem, MethodItem, MethodsResponse, MethodYearTrend
from app.schemas.paper import Paper
from app.services.domain_service import domain_service

logger = logging.getLogger("researchlens.methodservice")

CONFIG_DIR = Path(__file__).resolve().parent.parent.parent / "config"
LOCAL_CACHE_DIR = Path(__file__).resolve().parent.parent.parent / ".cache" / "domains"

GENERIC_STOPWORDS = {
    "paper", "method", "methods", "approach", "approaches", "model", "models",
    "proposed", "propose", "proposes", "results", "result", "using", "based",
    "study", "studies", "performance", "task", "tasks", "data", "dataset",
    "datasets", "analysis", "experimental", "experiments", "evaluation",
    "state", "art", "state of the art", "framework", "new", "demonstrate",
    "demonstrates", "show", "shows", "shown", "different", "existing",
    "problem", "problems", "work", "works", "achieve", "achieves",
    "application", "applications", "learning", "algorithm", "algorithms",
}


class MethodService:
    """Extracts methods, datasets, keyphrases, and temporal trends from domain paper abstracts."""

    def __init__(self):
        self.methods_config = self._load_config("methods.json")
        self.datasets_config = self._load_config("datasets.json")
        self._compiled_methods = self._compile_matchers(self.methods_config)
        self._compiled_datasets = self._compile_matchers(self.datasets_config)

    def _load_config(self, filename: str) -> List[Dict[str, Any]]:
        path = CONFIG_DIR / filename
        if not path.exists():
            fallback = Path(__file__).resolve().parent.parent.parent.parent / "config" / filename
            if fallback.exists():
                path = fallback

        if path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as exc:
                logger.error("Failed loading %s: %s", filename, exc)
        return []

    def _compile_matchers(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        compiled = []
        for item in items:
            aliases = item.get("aliases", [item["name"]])
            # Sort aliases by length descending so longer phrases match first
            sorted_aliases = sorted(aliases, key=len, reverse=True)
            escaped = [r"\b" + re.escape(a) + r"\b" for a in sorted_aliases]
            pattern_str = "|".join(escaped)
            try:
                regex = re.compile(pattern_str, re.IGNORECASE)
                compiled.append({
                    "id": item["id"],
                    "name": item["name"],
                    "category": item.get("category", "General"),
                    "regex": regex,
                })
            except re.error as exc:
                logger.error("Regex compile error for %s: %s", item["id"], exc)
        return compiled

    def _load_domain_papers(self, domain_id: str) -> List[Paper]:
        """Loads domain papers from local cache or domain store."""
        cache_file = LOCAL_CACHE_DIR / f"{domain_id}_papers.json"
        if cache_file.exists():
            try:
                with open(cache_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return [Paper(**p) for p in data]
            except Exception as exc:
                logger.debug("Failed reading papers cache for %s: %s", domain_id, exc)

        # Fallback to MongoDB if present
        if is_database_available():
            try:
                db = get_database()
                docs = list(db["papers"].find({"topics": domain_id}).limit(200))
                if docs:
                    return [Paper(**d) for d in docs]
            except Exception as exc:
                logger.debug("Failed querying papers from mongo: %s", exc)

        return []

    def analyze_domain_methods(self, domain_id: str) -> Optional[MethodsResponse]:
        """Computes method/dataset matches, TF-IDF keywords, and yearly trends."""
        domain = domain_service.get_domain(domain_id)
        if not domain:
            return None

        # Check local cache for precomputed methods
        cache_file = LOCAL_CACHE_DIR / f"{domain_id}_methods.json"
        if cache_file.exists():
            try:
                with open(cache_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return MethodsResponse(**data)
            except Exception as exc:
                logger.debug("Failed reading methods cache: %s", exc)

        papers = self._load_domain_papers(domain_id)
        if not papers:
            # If no papers cached yet, return clean empty response
            empty_resp = MethodsResponse(
                domain_id=domain_id,
                total_papers_analyzed=0,
                methods=[],
                datasets=[],
                keywords=[],
                trends=[],
            )
            return empty_resp

        total_papers = len(papers)

        # 1. Dictionary Matching for Methods and Datasets
        method_counts: Counter = Counter()
        method_paper_ids: Dict[str, List[str]] = defaultdict(list)
        method_year_counts: Dict[str, Counter] = defaultdict(Counter)

        dataset_counts: Counter = Counter()
        dataset_paper_ids: Dict[str, List[str]] = defaultdict(list)

        text_corpus: List[str] = []

        for p in papers:
            text = f"{p.title or ''} {p.abstract or ''}".strip()
            if text:
                text_corpus.append(text)

            p_year = p.year or 2024

            # Match methods
            for m in self._compiled_methods:
                if m["regex"].search(text):
                    method_counts[m["id"]] += 1
                    method_paper_ids[m["id"]].append(p.id)
                    method_year_counts[m["id"]][p_year] += 1

            # Match datasets
            for d in self._compiled_datasets:
                if d["regex"].search(text):
                    dataset_counts[d["id"]] += 1
                    dataset_paper_ids[d["id"]].append(p.id)

        # 2. Build MethodItems
        method_items: List[MethodItem] = []
        for m in self._compiled_methods:
            count = method_counts[m["id"]]
            if count > 0:
                pct = round((count / total_papers) * 100, 1)

                # Determine trending status
                y_counts = method_year_counts[m["id"]]
                recent_years = [y_counts.get(y, 0) for y in (2024, 2025, 2026)]
                earlier_years = [y_counts.get(y, 0) for y in (2021, 2022, 2023)]
                recent_sum = sum(recent_years)
                earlier_sum = sum(earlier_years)

                if recent_sum > earlier_sum and recent_sum >= 3:
                    status = "Trending"
                elif pct >= 15.0:
                    status = "Widely Used"
                elif pct >= 5.0:
                    status = "Stable"
                else:
                    status = "Emerging"

                method_items.append(
                    MethodItem(
                        id=m["id"],
                        name=m["name"],
                        category=m["category"],
                        count=count,
                        percentage=pct,
                        status=status,
                        example_paper_ids=method_paper_ids[m["id"]][:5],
                    )
                )

        method_items.sort(key=lambda x: x.count, reverse=True)

        # 3. Build DatasetItems
        dataset_items: List[DatasetItem] = []
        for d in self._compiled_datasets:
            count = dataset_counts[d["id"]]
            if count > 0:
                pct = round((count / total_papers) * 100, 1)
                dataset_items.append(
                    DatasetItem(
                        id=d["id"],
                        name=d["name"],
                        category=d["category"],
                        count=count,
                        percentage=pct,
                        example_paper_ids=dataset_paper_ids[d["id"]][:5],
                    )
                )

        dataset_items.sort(key=lambda x: x.count, reverse=True)

        # 4. Keyword Extraction via TF-IDF
        keyword_items: List[KeywordItem] = []
        if len(text_corpus) >= 3:
            try:
                tfidf = TfidfVectorizer(
                    ngram_range=(1, 2),
                    max_features=80,
                    stop_words="english",
                    min_df=2,
                )
                matrix = tfidf.fit_transform(text_corpus)
                feature_names = tfidf.get_feature_names_out()
                scores = matrix.mean(axis=0).A1

                ranked_indices = scores.argsort()[::-1]
                for idx in ranked_indices:
                    term = feature_names[idx].strip().lower()
                    if term in GENERIC_STOPWORDS or len(term) < 3:
                        continue
                    if any(w in GENERIC_STOPWORDS for w in term.split()):
                        continue

                    term_count = sum(1 for doc in text_corpus if term in doc.lower())
                    keyword_items.append(
                        KeywordItem(
                            term=term.title() if len(term) <= 4 else term,
                            score=round(float(scores[idx]), 4),
                            count=term_count,
                        )
                    )
                    if len(keyword_items) >= 20:
                        break
            except Exception as exc:
                logger.warning("TF-IDF keyword extraction failed: %s", exc)

        # 5. Method Year Trends (Top 8 methods over time)
        trends: List[MethodYearTrend] = []
        top_methods = method_items[:8]
        all_years = sorted({p.year for p in papers if p.year and p.year >= 2016})
        if not all_years:
            all_years = [2021, 2022, 2023, 2024, 2025]

        for tm in top_methods:
            y_map = {str(y): method_year_counts[tm.id].get(y, 0) for y in all_years}
            trends.append(
                MethodYearTrend(
                    method_id=tm.id,
                    method_name=tm.name,
                    yearly_counts=y_map,
                )
            )

        response = MethodsResponse(
            domain_id=domain_id,
            total_papers_analyzed=total_papers,
            methods=method_items,
            datasets=dataset_items,
            keywords=keyword_items,
            trends=trends,
        )

        # Cache locally
        try:
            LOCAL_CACHE_DIR.mkdir(parents=True, exist_ok=True)
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(response.model_dump(), f, indent=2)
        except Exception as exc:
            logger.debug("Failed saving methods cache: %s", exc)

        return response


method_service = MethodService()
