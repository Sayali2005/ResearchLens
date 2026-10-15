import asyncio
import json
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pathlib import Path
from pymongo import UpdateOne
from app.database.connection import get_database, is_database_available
from app.schemas.domain import Domain, DomainOverview, JobStatus, TopicInfo, TopicTrend
from app.services.openalex_adapter import openalex_adapter
from app.services.trend_service import trend_service

logger = logging.getLogger("researchlens.domain")
LOCAL_CACHE_DIR = Path(__file__).resolve().parent.parent.parent / ".cache" / "domains"



def slugify_domain(name: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")
    return cleaned or "default-domain"


class DomainService:
    """Manages domain resolution, topic hierarchy, yearly trends, and analysis job lifecycle."""

    def __init__(self):
        # In-memory stores for resilience when MongoDB is offline
        self._memory_jobs: Dict[str, JobStatus] = {}
        self._memory_domains: Dict[str, Domain] = {}
        self._memory_trends: Dict[str, List[TopicTrend]] = {}
        self._memory_topic_counts: Dict[str, Dict[str, Dict[int, int]]] = {}
        self._active_domain_jobs: Dict[str, str] = {}

    def get_job(self, job_id: str) -> Optional[JobStatus]:
        if job_id in self._memory_jobs:
            return self._memory_jobs[job_id]

        if is_database_available():
            try:
                db = get_database()
                doc = db["jobs"].find_one({"job_id": job_id})
                if doc:
                    doc.pop("_id", None)
                    return JobStatus(**doc)
            except Exception as exc:
                logger.debug("Failed to fetch job from MongoDB: %s", exc)
        return None

    def get_active_job_for_domain(self, domain_id: str) -> Optional[JobStatus]:
        job_id = self._active_domain_jobs.get(domain_id)
        if job_id:
            job = self.get_job(job_id)
            if job and job.status == "processing":
                return job

        if is_database_available():
            try:
                db = get_database()
                doc = db["jobs"].find_one({"domain_id": domain_id, "status": "processing"})
                if doc:
                    doc.pop("_id", None)
                    # Check staleness: if updated more than 90 seconds ago, it's an orphaned process
                    updated_str = doc.get("updated_at")
                    if updated_str:
                        try:
                            updated_dt = datetime.fromisoformat(updated_str)
                            if (datetime.now(timezone.utc) - updated_dt).total_seconds() > 90:
                                db["jobs"].update_one(
                                    {"job_id": doc["job_id"]},
                                    {"$set": {"status": "failed", "error": "Analysis timed out or process was restarted."}},
                                )
                                return None
                        except Exception:
                            pass
                    return JobStatus(**doc)
            except Exception as exc:
                logger.debug("Failed to fetch active job from MongoDB: %s", exc)
        return None

    def update_job(
        self,
        job_id: str,
        status: str,
        progress: int,
        message: str,
        error: Optional[str] = None,
    ) -> JobStatus:
        now_str = datetime.now(timezone.utc).isoformat()
        current = self.get_job(job_id)
        if not current:
            job = JobStatus(
                job_id=job_id,
                domain_id="",
                status=status,
                progress=progress,
                message=message,
                error=error,
                created_at=now_str,
                updated_at=now_str,
            )
        else:
            job = current.model_copy(
                update={
                    "status": status,
                    "progress": progress,
                    "message": message,
                    "error": error,
                    "updated_at": now_str,
                }
            )

        self._memory_jobs[job_id] = job

        if is_database_available():
            try:
                db = get_database()
                db["jobs"].update_one(
                    {"job_id": job_id},
                    {"$set": job.model_dump()},
                    upsert=True,
                )
            except Exception as exc:
                logger.debug("Failed to update job in MongoDB: %s", exc)

        return job

    async def start_analysis(self, domain_name: str) -> JobStatus:
        """Starts asynchronous domain analysis and returns a trackable job_id."""
        domain_id = slugify_domain(domain_name)

        # Check if already processing
        active_job = self.get_active_job_for_domain(domain_id)
        if active_job:
            return active_job

        job_id = str(uuid.uuid4())
        now_str = datetime.now(timezone.utc).isoformat()

        job = JobStatus(
            job_id=job_id,
            domain_id=domain_id,
            status="processing",
            progress=5,
            message="Queued analysis for domain...",
            created_at=now_str,
            updated_at=now_str,
        )
        self._memory_jobs[job_id] = job
        self._active_domain_jobs[domain_id] = job_id

        if is_database_available():
            try:
                db = get_database()
                db["jobs"].insert_one(job.model_dump())
            except Exception as exc:
                logger.debug("Failed to insert job into MongoDB: %s", exc)

        # Launch async task
        asyncio.create_task(self._run_analysis(job_id, domain_name, domain_id))
        return job

    async def _run_analysis(self, job_id: str, domain_name: str, domain_id: str):
        try:
            self.update_job(
                job_id,
                status="processing",
                progress=15,
                message=f"Resolving OpenAlex topic hierarchy for '{domain_name}'...",
            )

            # Step 1: Resolve topic hierarchy and sub-areas
            subfield_id, subfield_name, topics = await openalex_adapter.resolve_domain_hierarchy(
                domain_name, top_n=15
            )

            if not topics:
                # If no subfield matched, try searching works for topics
                suggested = await openalex_adapter.suggest_topics(domain_name, limit=15)
                topics = [TopicInfo(**s) for s in suggested]

            if not topics:
                self._active_domain_jobs.pop(domain_id, None)
                self.update_job(
                    job_id,
                    status="failed",
                    progress=100,
                    message="No matching research topics found.",
                    error=f"No OpenAlex topics found matching '{domain_name}'.",
                )
                return

            self.update_job(
                job_id,
                status="processing",
                progress=30,
                message=f"Identified {len(topics)} sub-areas. Fetching publication trends...",
            )

            # Step 2: Fetch yearly counts for each sub-area concurrently
            completed_count = 0
            total_topics = len(topics)

            async def fetch_topic_trend(topic: TopicInfo):
                nonlocal completed_count
                counts = await openalex_adapter.get_topic_yearly_counts(topic.topic_id)
                trend = trend_service.compute_topic_trend(
                    topic_id=topic.topic_id,
                    topic_name=topic.name,
                    yearly_counts_raw=counts,
                    years_range=10,
                    window_size=3,
                )
                completed_count += 1
                prog = 30 + int(50 * completed_count / total_topics)
                self.update_job(
                    job_id,
                    status="processing",
                    progress=prog,
                    message=f"Analyzing trajectory for {topic.name} ({completed_count}/{total_topics})...",
                )
                return topic.topic_id, counts, trend

            results = await asyncio.gather(*(fetch_topic_trend(t) for t in topics))
            topic_trends: List[TopicTrend] = []
            topic_counts_map: Dict[str, Dict[int, int]] = {}
            for t_id, cnts, tr in results:
                topic_counts_map[t_id] = cnts
                topic_trends.append(tr)

            # Step 3: Compute totals and persist
            total_papers = sum(t.total_count for t in topic_trends)
            domain = Domain(
                domain_id=domain_id,
                name=domain_name,
                field_or_subfield_id=subfield_id,
                subfield_name=subfield_name,
                topic_ids=[t.topic_id for t in topics],
                topics=topics,
                total_papers=total_papers,
            )

            # Save in memory
            self._memory_domains[domain_id] = domain
            self._memory_trends[domain_id] = topic_trends
            self._memory_topic_counts[domain_id] = topic_counts_map

            # Save locally for multi-process / restart durability
            try:
                LOCAL_CACHE_DIR.mkdir(parents=True, exist_ok=True)
                cache_payload = {
                    "domain": domain.model_dump(),
                    "trends": [t.model_dump() for t in topic_trends],
                    "topic_counts": topic_counts_map,
                }
                with open(LOCAL_CACHE_DIR / f"{domain_id}.json", "w", encoding="utf-8") as f:
                    json.dump(cache_payload, f, default=str)
            except Exception as exc:
                logger.debug("Could not write local domain file: %s", exc)

            # Save in MongoDB if available
            if is_database_available():
                try:
                    db = get_database()
                    db["domains"].update_one(
                        {"domain_id": domain_id},
                        {"$set": domain.model_dump()},
                        upsert=True,
                    )
                    now_iso = datetime.now(timezone.utc).isoformat()
                    # Persist yearly counts via single bulk write
                    counts_ops = [
                        UpdateOne(
                            {"domain_id": domain_id, "topic_id": t_id, "year": yr},
                            {
                                "$set": {
                                    "domain_id": domain_id,
                                    "topic_id": t_id,
                                    "year": yr,
                                    "count": c,
                                    "fetched_at": now_iso,
                                }
                            },
                            upsert=True,
                        )
                        for t_id, cnts in topic_counts_map.items()
                        for yr, c in cnts.items()
                    ]
                    if counts_ops:
                        db["topic_year_counts"].bulk_write(counts_ops, ordered=False)

                    # Persist trend labels via single bulk write
                    labels_ops = [
                        UpdateOne(
                            {"domain_id": domain_id, "topic_id": tr.topic_id},
                            {
                                "$set": {
                                    "domain_id": domain_id,
                                    "topic_id": tr.topic_id,
                                    "gbar": tr.gbar,
                                    "label": tr.label,
                                    "computed_at": now_iso,
                                }
                            },
                            upsert=True,
                        )
                        for tr in topic_trends
                    ]
                    if labels_ops:
                        db["trend_labels"].bulk_write(labels_ops, ordered=False)
                except Exception as exc:
                    logger.debug("Failed saving domain analytics to MongoDB: %s", exc)

            self._active_domain_jobs.pop(domain_id, None)
            self.update_job(
                job_id,
                status="completed",
                progress=100,
                message=f"Analysis completed successfully for {domain_name}.",
            )

        except Exception as exc:
            self._active_domain_jobs.pop(domain_id, None)
            logger.exception("Domain analysis job %s encountered an error: %s", job_id, exc)
            self.update_job(
                job_id,
                status="failed",
                progress=100,
                message="Analysis failed due to an error.",
                error=str(exc),
            )

    def get_domain(self, domain_id: str) -> Optional[Domain]:
        if domain_id in self._memory_domains:
            return self._memory_domains[domain_id]
        if is_database_available():
            try:
                db = get_database()
                doc = db["domains"].find_one({"domain_id": domain_id})
                if doc:
                    doc.pop("_id", None)
                    domain = Domain(**doc)
                    self._memory_domains[domain_id] = domain
                    return domain
            except Exception as exc:
                logger.debug("Failed to read domain from MongoDB: %s", exc)

        # Try local cache file
        local_file = LOCAL_CACHE_DIR / f"{domain_id}.json"
        if local_file.exists():
            try:
                with open(local_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    domain = Domain(**data["domain"])
                    self._memory_domains[domain_id] = domain
                    self._memory_trends[domain_id] = [TopicTrend(**t) for t in data.get("trends", [])]
                    return domain
            except Exception as exc:
                logger.debug("Failed to read local domain cache: %s", exc)

        return None


    def get_domain_overview(self, domain_id: str) -> Optional[DomainOverview]:
        domain = self.get_domain(domain_id)
        if not domain:
            return None

        trends = self.get_domain_trends(domain_id)
        trends_map = {t.topic_id: t for t in trends}

        sub_areas: List[Dict[str, Any]] = []
        for t in domain.topics:
            t_trend = trends_map.get(t.topic_id)
            sub_areas.append(
                {
                    "topic_id": t.topic_id,
                    "name": t.name,
                    "count": t_trend.total_count if t_trend else t.works_count,
                    "label": t_trend.label if t_trend else "Stable",
                    "gbar": t_trend.gbar if t_trend else 0.0,
                    "growth_rate_pct": round((t_trend.gbar if t_trend else 0.0) * 100, 1),
                }
            )

        # Sort sub-areas by count descending
        sub_areas.sort(key=lambda s: s["count"], reverse=True)

        return DomainOverview(
            domain_id=domain.domain_id,
            name=domain.name,
            total_papers=domain.total_papers or sum(s["count"] for s in sub_areas),
            sub_areas=sub_areas,
            data_freshness=domain.updated_at,
            sources=["OpenAlex", "Semantic Scholar", "arXiv"],
        )

    def get_domain_trends(
        self,
        domain_id: str,
        from_year: Optional[int] = None,
        to_year: Optional[int] = None,
    ) -> List[TopicTrend]:
        trends = self._memory_trends.get(domain_id, [])
        if not trends:
            self.get_domain(domain_id)
            trends = self._memory_trends.get(domain_id, [])

        if not trends and is_database_available():
            try:
                db = get_database()
                domain = self.get_domain(domain_id)

                if domain:
                    reconstructed: List[TopicTrend] = []
                    for topic in domain.topics:
                        rows = list(
                            db["topic_year_counts"].find(
                                {"domain_id": domain_id, "topic_id": topic.topic_id}
                            )
                        )
                        raw_counts = {int(r["year"]): int(r["count"]) for r in rows}
                        trend = trend_service.compute_topic_trend(
                            topic_id=topic.topic_id,
                            topic_name=topic.name,
                            yearly_counts_raw=raw_counts,
                        )
                        reconstructed.append(trend)
                    self._memory_trends[domain_id] = reconstructed
                    trends = reconstructed
            except Exception as exc:
                logger.debug("Failed reading trends from MongoDB: %s", exc)

        if from_year or to_year:
            filtered: List[TopicTrend] = []
            for t in trends:
                y_counts = [
                    yc
                    for yc in t.yearly_counts
                    if (from_year is None or yc.year >= from_year)
                    and (to_year is None or yc.year <= to_year)
                ]
                g_rates = [
                    gr
                    for gr in t.growth_rates
                    if (from_year is None or gr.year >= from_year)
                    and (to_year is None or gr.year <= to_year)
                ]
                filtered.append(
                    t.model_copy(
                        update={
                            "yearly_counts": y_counts,
                            "growth_rates": g_rates,
                            "total_count": sum(c.count for c in y_counts),
                        }
                    )
                )
            return filtered

        return trends


domain_service = DomainService()
