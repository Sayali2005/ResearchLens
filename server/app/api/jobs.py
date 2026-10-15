from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from app.services.domain_service import domain_service

router = APIRouter(
    prefix="/api/jobs",
    tags=["Jobs"],
)


@router.get("/{job_id}")
async def get_job_status(job_id: str):
    job = domain_service.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=404,
            detail=f"Job with ID '{job_id}' not found.",
        )

    return {
        "success": True,
        "data": job.model_dump(),
        "meta": {
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "sources": ["ResearchLens Background Job Runner"],
        },
    }
