from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from app.services.domain_service import domain_service
from app.services.gap_service import gap_service
from app.services.openalex_adapter import openalex_adapter
from app.services.paper_service import paper_service
from app.services.method_service import method_service
from app.services.challenge_service import challenge_service
from app.services.suggestion_service import suggestion_service



router = APIRouter(
    prefix="/api/domains",
    tags=["Domains"],
)


class AnalyzeDomainRequest(BaseModel):
    domain: str = Field(..., min_length=2, description="Domain topic name to analyze")


@router.get("/suggest")
async def suggest_domains(
    q: str = Query(..., min_length=1, description="Domain search prefix or query"),
    limit: int = Query(8, ge=1, le=20, description="Max suggestions to return"),
):
    try:
        suggestions = await openalex_adapter.suggest_topics(q, limit=limit)
        return {
            "success": True,
            "data": suggestions,
            "meta": {
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "sources": ["OpenAlex Topic Hierarchy"],
            },
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Domain suggestion failed: {str(exc)}",
        )


@router.post("/analyze")
async def analyze_domain(request: AnalyzeDomainRequest):
    try:
        job = await domain_service.start_analysis(request.domain)
        return {
            "success": True,
            "data": job.model_dump(),
            "meta": {
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "sources": ["OpenAlex"],
            },
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start analysis for domain '{request.domain}': {str(exc)}",
        )


@router.get("/{id}/job")
async def get_domain_job(id: str):
    """Retrieve active or latest analysis job for a domain."""
    job = domain_service.get_active_job_for_domain(id)
    return {
        "success": True,
        "data": job.model_dump() if job else None,
    }


@router.get("/{id}/overview")
async def get_domain_overview(id: str):
    overview = domain_service.get_domain_overview(id)
    if not overview:
        active_job = domain_service.get_active_job_for_domain(id)
        if active_job:
            raise HTTPException(
                status_code=404,
                detail=f"Analysis for domain '{id}' is currently in progress ({active_job.progress}%).",
                headers={"X-Job-Id": active_job.job_id, "X-Job-Status": active_job.status},
            )
        raise HTTPException(
            status_code=404,
            detail=f"Domain '{id}' not found. Please trigger analysis first via /api/domains/analyze.",
        )

    return {
        "success": True,
        "data": overview.model_dump(),
        "meta": {
            "cached": True,
            "fetched_at": overview.data_freshness,
            "sources": overview.sources,
        },
    }


@router.get("/{id}/trends")
async def get_domain_trends(
    id: str,
    from_year: Optional[int] = Query(None, alias="from", description="Start year filter"),
    to_year: Optional[int] = Query(None, alias="to", description="End year filter"),
):
    trends = domain_service.get_domain_trends(id, from_year=from_year, to_year=to_year)
    if not trends:
        # Check if domain exists
        domain = domain_service.get_domain(id)
        if not domain:
            raise HTTPException(
                status_code=404,
                detail=f"Domain '{id}' not found. Please trigger analysis first via /api/domains/analyze.",
            )

    return {
        "success": True,
        "data": {
            "domain_id": id,
            "trends": [t.model_dump() for t in trends],
        },
        "meta": {
            "cached": True,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "sources": ["OpenAlex"],
        },
    }


@router.get("/{id}/gaps")
async def get_domain_gaps(
    id: str,
    apps: Optional[str] = Query(None, description="Comma-separated application area IDs"),
):
    app_ids = [a.strip() for a in apps.split(",") if a.strip()] if apps else None
    matrix = await gap_service.compute_gap_matrix(id, app_ids=app_ids)
    if not matrix:
        raise HTTPException(
            status_code=404,
            detail=f"Domain '{id}' not found. Please trigger analysis first via /api/domains/analyze.",
        )

    return {
        "success": True,
        "data": matrix.model_dump(),
        "meta": {
            "cached": True,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "sources": ["OpenAlex Work Counts"],
        },
    }


@router.get("/{id}/papers")
async def get_domain_papers(
    id: str,
    year_from: Optional[int] = Query(None, description="Start year filter"),
    year_to: Optional[int] = Query(None, description="End year filter"),
    venue_tier: Optional[str] = Query(None, description="Venue tier filter (tier_1, tier_2, tier_3, preprint, all)"),
    institution_group: Optional[str] = Query(None, description="Institution group filter (group_a, group_b, group_c, all)"),
    top_only: bool = Query(False, description="Filter to top venues or institutions only"),
    min_citations: int = Query(0, ge=0, description="Minimum citation count threshold"),
    open_access: bool = Query(False, description="Filter for open access papers only"),
    type: Optional[str] = Query(None, description="Paper type filter (article, preprint, review)"),
    sort: str = Query("quality", description="Sort by quality, citations, or recency"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Results per page"),
):
    domain = domain_service.get_domain(id)
    if not domain:
        raise HTTPException(
            status_code=404,
            detail=f"Domain '{id}' not found. Please trigger analysis first via /api/domains/analyze.",
        )

    res = await paper_service.get_domain_papers(
        domain_id=id,
        year_from=year_from,
        year_to=year_to,
        venue_tier=venue_tier,
        institution_group=institution_group,
        top_only=top_only,
        min_citations=min_citations,
        open_access_only=open_access,
        paper_type=type,
        sort=sort,
        page=page,
        limit=limit,
    )

    return {
        "success": True,
        "data": res,
        "meta": {
            "cached": True,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "sources": ["OpenAlex", "Semantic Scholar", "arXiv"],
        },
    }


@router.get("/{id}/methods")
async def get_domain_methods(id: str):
    domain = domain_service.get_domain(id)
    if not domain:
        raise HTTPException(
            status_code=404,
            detail=f"Domain '{id}' not found. Please trigger analysis first via /api/domains/analyze.",
        )
    resp = method_service.analyze_domain_methods(id)
    if not resp:
        raise HTTPException(
            status_code=404,
            detail=f"Domain '{id}' not found.",
        )
    return {
        "success": True,
        "data": resp.model_dump(),
        "meta": {
            "cached": True,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "sources": ["Domain Paper Abstracts", "TF-IDF Extractor", "Methods/Datasets Whitelists"],
        },
    }


@router.get("/{id}/challenges")
async def get_domain_challenges(id: str):
    domain = domain_service.get_domain(id)
    if not domain:
        raise HTTPException(
            status_code=404,
            detail=f"Domain '{id}' not found. Please trigger analysis first via /api/domains/analyze.",
        )
    resp = challenge_service.extract_domain_challenges(id)
    if not resp:
        raise HTTPException(
            status_code=404,
            detail=f"Domain '{id}' not found.",
        )
    return {
        "success": True,
        "data": resp.model_dump(),
        "meta": {
            "cached": True,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "sources": ["Survey & Top Paper Abstracts", "Pattern Matcher"],
        },
    }


@router.get("/{id}/suggestions")
async def get_domain_suggestions(id: str):
    domain = domain_service.get_domain(id)
    if not domain:
        raise HTTPException(
            status_code=404,
            detail=f"Domain '{id}' not found. Please trigger analysis first via /api/domains/analyze.",
        )
    resp = await suggestion_service.generate_suggestions_and_roadmap(id)
    if not resp:
        raise HTTPException(
            status_code=404,
            detail=f"Domain '{id}' not found.",
        )
    return {
        "success": True,
        "data": resp.model_dump(),
        "meta": {
            "cached": True,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "sources": ["Gap Matrix", "Paper Quality Scores", "Open Challenges"],
        },
    }


