from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.config_api import router as config_router
from app.api.domains import router as domains_router
from app.api.export_api import router as export_router
from app.api.health import router as health_router
from app.api.jobs import router as jobs_router
from app.api.papers import router as papers_router
from app.config.settings import settings

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(papers_router)
app.include_router(domains_router)
app.include_router(jobs_router)
app.include_router(config_router)
app.include_router(export_router)



@app.get("/")
def root():
    return {
        "success": True,
        "message": "ResearchLens AI API running successfully",
    }
