import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple
from app.schemas.domain import GrowthRate, TopicTrend, YearlyCount

logger = logging.getLogger("researchlens.trend")

CONFIG_PATH = Path(__file__).resolve().parent.parent.parent / "config" / "analysis.json"


def load_analysis_config() -> Dict[str, Any]:
    defaults = {
        "emerging_growth_threshold": 0.25,
        "declining_growth_threshold": -0.10,
        "min_last_year_count": 30,
        "growth_window_years": 3,
        "default_years_range": 10,
        "default_top_topics": 15,
        "exclude_current_year": true if False else True,
    }
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                defaults.update(data)
        except Exception as exc:
            logger.warning("Could not read analysis.json: %s", exc)
    return defaults


class TrendService:
    """Calculates yearly paper counts, historical growth rates, and trend classifications."""

    def __init__(self):
        self.config = load_analysis_config()

    def get_current_year(self) -> int:
        return datetime.now(timezone.utc).year

    def compute_topic_trend(
        self,
        topic_id: str,
        topic_name: str,
        yearly_counts_raw: Dict[int, int],
        years_range: int = 10,
        window_size: int = 3,
    ) -> TopicTrend:
        current_year = self.get_current_year()
        # Complete years range: [current_year - years_range, current_year - 1]
        start_year = current_year - years_range
        end_complete_year = current_year - 1

        yearly_counts: List[YearlyCount] = []
        for y in range(start_year, current_year + 1):
            cnt = yearly_counts_raw.get(y, 0)
            yearly_counts.append(YearlyCount(year=y, count=cnt))

        # Calculate annual growth rates for complete years
        growth_rates: List[GrowthRate] = []
        for y in range(start_year + 1, end_complete_year + 1):
            prev_cnt = yearly_counts_raw.get(y - 1, 0)
            curr_cnt = yearly_counts_raw.get(y, 0)
            if prev_cnt > 0:
                rate = (curr_cnt - prev_cnt) / prev_cnt
            else:
                rate = 1.0 if curr_cnt > 0 else 0.0
            growth_rates.append(GrowthRate(year=y, rate=round(rate, 4)))

        # Average growth over last w complete years
        window_years = [end_complete_year - i for i in range(window_size)]
        window_rates = [
            gr.rate for gr in growth_rates if gr.year in window_years
        ]

        gbar = sum(window_rates) / len(window_rates) if window_rates else 0.0
        gbar = round(gbar, 4)

        last_year_count = yearly_counts_raw.get(end_complete_year, 0)
        total_count = sum(c.count for c in yearly_counts)

        # Classify label
        emerging_thresh = self.config.get("emerging_growth_threshold", 0.25)
        declining_thresh = self.config.get("declining_growth_threshold", -0.10)
        min_last_cnt = self.config.get("min_last_year_count", 30)

        if gbar >= emerging_thresh and last_year_count >= min_last_cnt:
            label = "Emerging"
        elif gbar <= declining_thresh:
            label = "Declining"
        else:
            label = "Stable"

        return TopicTrend(
            topic_id=topic_id,
            name=topic_name,
            yearly_counts=yearly_counts,
            growth_rates=growth_rates,
            gbar=gbar,
            label=label,
            total_count=total_count,
            last_complete_year_count=last_year_count,
        )


trend_service = TrendService()
