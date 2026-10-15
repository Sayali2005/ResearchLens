from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, Field


class Institution(BaseModel):
    name: str
    ror: Optional[str] = None
    country: Optional[str] = None


class Author(BaseModel):
    name: str
    id: Optional[str] = None
    institutions: List[Institution] = Field(default_factory=list)


class Paper(BaseModel):
    id: str
    doi: Optional[str] = None
    arxiv_id: Optional[str] = None
    title: str
    abstract: Optional[str] = None
    year: Optional[int] = None
    publication_date: Optional[str] = None
    venue: Optional[str] = None
    venue_type: Optional[str] = None
    authors: List[Author] = Field(default_factory=list)
    citation_count: int = 0
    influential_citation_count: int = 0
    is_open_access: bool = False
    pdf_url: Optional[str] = None
    landing_url: Optional[str] = None
    topics: List[str] = Field(default_factory=list)
    type: str = "article"  # article, preprint, review
    source: str = "unknown"  # openalex, semantic_scholar, arxiv
    fetched_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class PaperSearchResponse(BaseModel):
    success: bool = True
    query: str
    count: int
    papers: List[Paper]
    meta: dict = Field(default_factory=dict)