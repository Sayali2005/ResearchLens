from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class PaperSummary(BaseModel):
    id: str
    title: str
    year: Optional[int] = None
    venue: Optional[str] = None
    citation_count: int = 0
    authors: List[str] = Field(default_factory=list)
    landing_url: Optional[str] = None
    pdf_url: Optional[str] = None
    is_open_access: bool = False
    is_review: bool = False


class MethodItem(BaseModel):
    id: str
    name: str
    category: str
    count: int
    percentage: float
    status: str = "Widely Used"
    example_paper_ids: List[str] = Field(default_factory=list)


class DatasetItem(BaseModel):
    id: str
    name: str
    category: str
    count: int
    percentage: float
    example_paper_ids: List[str] = Field(default_factory=list)


class KeywordItem(BaseModel):
    term: str
    score: float
    count: int


class MethodYearTrend(BaseModel):
    method_id: str
    method_name: str
    yearly_counts: Dict[str, int]


class MethodsResponse(BaseModel):
    domain_id: str
    total_papers_analyzed: int
    methods: List[MethodItem]
    datasets: List[DatasetItem]
    keywords: List[KeywordItem]
    trends: List[MethodYearTrend]


class ChallengeItem(BaseModel):
    id: str
    sentence: str
    highlighted_sentence: str
    pattern: str
    category: str
    score: float
    source_paper: PaperSummary


class ChallengesResponse(BaseModel):
    domain_id: str
    total_challenges: int
    challenges: List[ChallengeItem]


class SuggestionCard(BaseModel):
    id: str
    title: str
    sub_area: str
    sub_area_id: str
    application: str
    application_id: str
    why: str
    observed: int
    expected: float
    ratio: float
    opportunity: float
    sub_area_trend: str
    keywords: List[str]
    example_papers: List[PaperSummary]
    related_challenges: List[str]


class RoadmapStage(BaseModel):
    stage: int
    title: str
    description: str
    papers: List[PaperSummary]


class SuggestionsResponse(BaseModel):
    domain_id: str
    disclaimer: str
    suggestions: List[SuggestionCard]
    roadmap: List[RoadmapStage]
