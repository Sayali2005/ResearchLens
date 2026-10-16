import asyncio
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
from pymongo import UpdateOne
from app.database.connection import get_database, is_database_available
from app.schemas.gap import ApplicationArea, GapCell, GapMatrix
from app.services.domain_service import domain_service
from app.services.openalex_adapter import openalex_adapter

logger = logging.getLogger("researchlens.gap")

CONFIG_PATH = Path(__file__).resolve().parent.parent.parent / "config" / "applications.json"
LOCAL_CACHE_DIR = Path(__file__).resolve().parent.parent.parent / ".cache" / "domains"


class GapService:
    """Computes the research gap heatmap matrix and evaluates opportunity scores."""

    def __init__(self):
        self._applications: List[ApplicationArea] = []
        self._load_applications()

    def _load_applications(self):
        if CONFIG_PATH.exists():
            try:
                with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self._applications = [ApplicationArea(**item) for item in data]
            except Exception as exc:
                logger.warning("Could not read applications.json: %s", exc)

    def get_applications(self, app_ids: Optional[List[str]] = None) -> List[ApplicationArea]:
        if not self._applications:
            self._load_applications()
        if not app_ids:
            return self._applications
        filter_set = {a.lower().strip() for a in app_ids}
        return [app for app in self._applications if app.id.lower() in filter_set]

    async def compute_gap_matrix(
        self,
        domain_id: str,
        app_ids: Optional[List[str]] = None,
    ) -> Optional[GapMatrix]:
        domain = domain_service.get_domain(domain_id)
        if not domain:
            return None

        # Check local cache first
        cache_key_str = f"{domain_id}_gaps" + ("_" + "-".join(sorted(app_ids)) if app_ids else "")
        local_cache_file = LOCAL_CACHE_DIR / f"{cache_key_str}.json"
        if local_cache_file.exists():
            try:
                with open(local_cache_file, "r", encoding="utf-8") as f:
                    cached_data = json.load(f)
                    return GapMatrix(**cached_data)
            except Exception as exc:
                logger.debug("Failed reading gaps local cache: %s", exc)

        apps = self.get_applications(app_ids)
        topics = domain.topics[:15]  # Top 15 sub-areas

        # Step 1: Collect observed counts for each topic and application area
        # Use asyncio.gather with rate limiter in http_client
        tasks = []
        cell_coords = []
        for t in topics:
            for a in apps:
                cell_coords.append((t, a))
                tasks.append(
                    openalex_adapter.get_topic_application_count(t.topic_id, a.query)
                )

        counts = await asyncio.gather(*tasks, return_exceptions=True)

        observed_grid: Dict[str, Dict[str, int]] = {t.topic_id: {} for t in topics}
        for (topic, app), count in zip(cell_coords, counts):
            val = count if isinstance(count, int) else 0
            observed_grid[topic.topic_id][app.id] = val

        # Step 2: Compute row totals, column totals, grand total
        row_totals: Dict[str, int] = {
            t.topic_id: sum(observed_grid[t.topic_id].values()) for t in topics
        }
        col_totals: Dict[str, int] = {
            a.id: sum(observed_grid[t.topic_id].get(a.id, 0) for t in topics)
            for a in apps
        }
        grand_total = sum(row_totals.values())

        # Step 3: Compute popularity percentile ranks
        # Sort rows and cols by total count
        sorted_rows = sorted(topics, key=lambda t: row_totals.get(t.topic_id, 0))
        num_rows = max(1, len(sorted_rows))
        row_pop: Dict[str, float] = {
            t.topic_id: round((idx + 1) / num_rows, 4)
            for idx, t in enumerate(sorted_rows)
        }

        sorted_cols = sorted(apps, key=lambda a: col_totals.get(a.id, 0))
        num_cols = max(1, len(sorted_cols))
        col_pop: Dict[str, float] = {
            a.id: round((idx + 1) / num_cols, 4)
            for idx, a in enumerate(sorted_cols)
        }

        # Step 4: Calculate expected, ratio, opportunity for each cell
        cells: List[GapCell] = []
        for t in topics:
            r_tot = row_totals.get(t.topic_id, 0)
            p_row = row_pop.get(t.topic_id, 0.5)

            for a in apps:
                c_tot = col_totals.get(a.id, 0)
                p_col = col_pop.get(a.id, 0.5)
                obs = observed_grid[t.topic_id].get(a.id, 0)

                if grand_total > 0:
                    exp = (r_tot * c_tot) / grand_total
                else:
                    exp = 0.0

                if exp > 0:
                    ratio = obs / exp
                    # Poisson Significance Z-Score: Z = (Observed - Expected) / sqrt(Expected)
                    z_score = round((obs - exp) / (exp ** 0.5), 2)
                else:
                    ratio = 1.0 if obs > 0 else 0.0
                    z_score = 0.0

                is_significant_void = bool(z_score < -2.0 and exp >= 5.0)

                # Opportunity formula: min(pop_i, pop_j) * (1 - min(1, ratio))
                opp = min(p_row, p_col) * (1.0 - min(1.0, ratio))

                cells.append(
                    GapCell(
                        domain_id=domain_id,
                        topic_id=t.topic_id,
                        topic_name=t.name,
                        application_id=a.id,
                        application_name=a.name,
                        observed=obs,
                        expected=round(exp, 1),
                        ratio=round(ratio, 2),
                        opportunity=round(opp, 4),
                        row_total=r_tot,
                        col_total=c_tot,
                        is_top_opportunity=False,
                        z_score=z_score,
                        is_significant_void=is_significant_void,
                    )
                )

        # Step 5: Rank top opportunity candidates
        # Must pass a minimum threshold on row and col totals to avoid noise
        candidates = [
            c
            for c in cells
            if c.row_total >= 5 and c.col_total >= 5 and c.ratio < 0.85
        ]
        candidates.sort(key=lambda c: c.opportunity, reverse=True)

        top_cells = candidates[:8]
        top_cell_keys = {(c.topic_id, c.application_id) for c in top_cells}

        for c in cells:
            if (c.topic_id, c.application_id) in top_cell_keys:
                c.is_top_opportunity = True

        matrix = GapMatrix(
            domain_id=domain_id,
            domain_name=domain.name,
            sub_areas=[
                {"id": t.topic_id, "name": t.name, "total": row_totals.get(t.topic_id, 0)}
                for t in topics
            ],
            applications=[
                {"id": a.id, "name": a.name, "total": col_totals.get(a.id, 0)}
                for a in apps
            ],
            cells=cells,
            top_opportunities=top_cells,
            grand_total=grand_total,
        )

        # Save to local file cache
        try:
            LOCAL_CACHE_DIR.mkdir(parents=True, exist_ok=True)
            with open(local_cache_file, "w", encoding="utf-8") as f:
                json.dump(matrix.model_dump(), f, default=str)
        except Exception as exc:
            logger.debug("Failed saving gap matrix to local cache: %s", exc)

        # Save to MongoDB gap_cells if available
        if is_database_available():
            try:
                db = get_database()
                coll = db["gap_cells"]
                coll.create_index(
                    [("domain_id", 1), ("topic_id", 1), ("application_id", 1)],
                    unique=True,
                )
                coll.create_index([("domain_id", 1), ("opportunity", -1)])

                bulk_ops = [
                    UpdateOne(
                        {
                            "domain_id": domain_id,
                            "topic_id": c.topic_id,
                            "application_id": c.application_id,
                        },
                        {"$set": c.model_dump()},
                        upsert=True,
                    )
                    for c in cells
                ]
                if bulk_ops:
                    coll.bulk_write(bulk_ops, ordered=False)
            except Exception as exc:
                logger.debug("Failed saving gap cells to MongoDB: %s", exc)

        return matrix


gap_service = GapService()
