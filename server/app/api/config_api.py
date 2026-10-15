from datetime import datetime, timezone
from fastapi import APIRouter
from app.services.gap_service import gap_service

router = APIRouter(
    prefix="/api/config",
    tags=["Configuration"],
)


@router.get("/applications")
def get_applications():
    apps = gap_service.get_applications()
    return {
        "success": True,
        "data": [a.model_dump() for a in apps],
        "meta": {
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "sources": ["ResearchLens Domain Configuration"],
        },
    }
