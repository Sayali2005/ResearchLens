from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class TopicInfo(BaseModel):
    topic_id: str
    name: str
    works_count: int = 0
    subfield_id: Optional[str] = None
    subfield_name: Optional[str] = None
    field_id: Optional[str] = None
    field_name: Optional[str] = None


class Domain(BaseModel):
    domain_id: str
    name: str
    field_or_subfield_id: Optional[str] = None
    subfield_name: Optional[str] = None
    topic_ids: List[str] = Field(default_factory=list)
    topics: List[TopicInfo] = Field(default_factory=list)
    total_papers: int = 0
    updated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class YearlyCount(BaseModel):
    year: int
    count: int


class GrowthRate(BaseModel):
    year: int
    rate: float


class TopicTrend(BaseModel):
    topic_id: str
    name: str
    yearly_counts: List[YearlyCount] = Field(default_factory=list)
    growth_rates: List[GrowthRate] = Field(default_factory=list)
    gbar: float = 0.0
    label: str = "Stable"  # Emerging, Stable, Declining
    total_count: int = 0
    last_complete_year_count: int = 0


class DomainOverview(BaseModel):
    domain_id: str
    name: str
    total_papers: int
    sub_areas: List[Dict[str, Any]] = Field(default_factory=list)
    data_freshness: str
    sources: List[str] = Field(
        default_factory=lambda: ["OpenAlex", "Semantic Scholar", "arXiv"]
    )


class JobStatus(BaseModel):
    job_id: str
    domain_id: str
    status: str = "pending"  # pending, processing, completed, failed
    progress: int = 0  # 0 to 100
    message: str = "Initializing analysis..."
    error: Optional[str] = None
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
