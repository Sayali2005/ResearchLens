import asyncio
import json
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
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


@router.get("/{job_id}/stream")
async def stream_job_status(job_id: str):
    """Server-Sent Events (SSE) live radar and status stream for real-time progress."""
    job = domain_service.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=404,
            detail=f"Job with ID '{job_id}' not found.",
        )

    async def event_generator():
        # Keep connection open and push job state changes
        max_duration_seconds = 180
        start_time = asyncio.get_event_loop().time()
        while True:
            current_job = domain_service.get_job(job_id)
            if not current_job:
                yield f"data: {json.dumps({'status': 'failed', 'error': 'Job terminated'})}\n\n"
                break

            data = current_job.model_dump()
            yield f"data: {json.dumps(data)}\n\n"

            if current_job.status in ("completed", "failed"):
                break

            if asyncio.get_event_loop().time() - start_time > max_duration_seconds:
                break

            await asyncio.sleep(0.4)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

