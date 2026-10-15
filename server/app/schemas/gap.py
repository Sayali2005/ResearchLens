from typing import Any, Dict, List
from pydantic import BaseModel, Field


class ApplicationArea(BaseModel):
    id: str
    name: str
    query: str
    keywords: List[str] = Field(default_factory=list)


class GapCell(BaseModel):
    domain_id: str
    topic_id: str
    topic_name: str
    application_id: str
    application_name: str
    observed: int
    expected: float
    ratio: float
    opportunity: float
    row_total: int
    col_total: int
    is_top_opportunity: bool = False


class GapMatrix(BaseModel):
    domain_id: str
    domain_name: str
    sub_areas: List[Dict[str, Any]]
    applications: List[Dict[str, Any]]
    cells: List[GapCell]
    top_opportunities: List[GapCell]
    grand_total: int
    disclaimer: str = (
        "Gaps are candidates based on paper counts and keyword matches. "
        "A low count can mean an unpopular or impractical area as well as an opportunity. "
        "Always check the linked papers before choosing."
    )
