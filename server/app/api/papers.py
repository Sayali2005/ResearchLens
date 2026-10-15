from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query
from app.services.paper_service import paper_service

router = APIRouter(
    prefix="/api/papers",
    tags=["Papers"],
)


@router.get("/search")
async def search_papers(
    query: str = Query(
        ...,
        min_length=2,
        description="Research topic or search query",
    ),
    limit: int = Query(
        10,
        ge=1,
        le=50,
        description="Number of papers to return",
    ),
    year_from: int = Query(
        None,
        description="Optional minimum publication year",
    ),
    year_to: int = Query(
        None,
        description="Optional maximum publication year",
    ),
):
    try:
        papers = await paper_service.search_papers(
            query=query,
            limit=limit,
            year_from=year_from,
            year_to=year_to,
        )

        sources = list({p.source for p in papers})
        now_str = datetime.now(timezone.utc).isoformat()

        return {
            "success": True,
            "data": {
                "query": query,
                "count": len(papers),
                "papers": [p.model_dump() for p in papers],
            },
            # Backward-compatibility fields
            "query": query,
            "count": len(papers),
            "papers": [p.model_dump() for p in papers],
            "meta": {
                "fetched_at": now_str,
                "sources": sources or ["openalex", "semantic_scholar", "arxiv"],
            },
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Paper search failed: {str(error)}",
        )


@router.get("/{id:path}")
async def get_paper_detail(id: str):
    paper_dict = await paper_service.get_paper_detail(id)
    if not paper_dict:
        raise HTTPException(
            status_code=404,
            detail=f"Paper with ID '{id}' not found.",
        )

    return {
        "success": True,
        "data": paper_dict,
        "meta": {
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "sources": [paper_dict.get("source", "scholarly_source")],
        },
    }