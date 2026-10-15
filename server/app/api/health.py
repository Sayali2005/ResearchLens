from fastapi import APIRouter
from app.database.connection import check_database_connection

router = APIRouter()

@router.get("/api/health")
async def health_check():
    db_status = check_database_connection()

    if db_status:
        return {"status": "healthy", "database": "connected"}
    else:
        return {"status": "unhealthy", "database": "disconnected"}