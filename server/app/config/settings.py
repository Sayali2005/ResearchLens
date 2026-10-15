import os
from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment or .env file."""

    model_config = SettingsConfigDict(
        env_file=(".env", "server/.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = Field(default="ResearchLens AI", description="Application name")
    APP_VERSION: str = Field(default="1.0.0", description="Application version")

    # Scholarly APIs
    OPENALEX_API_KEY: Optional[str] = Field(
        default=None,
        description="OpenAlex API key for usage-based rate limits",
    )
    OPENALEX_BASE_URL: str = Field(
        default="https://api.openalex.org",
        description="Base URL for OpenAlex API",
    )
    SEMANTIC_SCHOLAR_API_KEY: Optional[str] = Field(
        default=None,
        description="Semantic Scholar API key (sent as x-api-key)",
    )
    SEMANTIC_SCHOLAR_API_URL: str = Field(
        default="https://api.semanticscholar.org/graph/v1",
        description="Semantic Scholar Graph API base URL",
    )
    CONTACT_EMAIL: Optional[str] = Field(
        default=None,
        description="Contact email sent to OpenAlex / Crossref / Unpaywall for politeness pool",
    )

    # Database
    MONGODB_URI: str = Field(
        default="mongodb://localhost:27017",
        description="MongoDB connection URI (local or MongoDB Atlas)",
    )
    MONGODB_DATABASE: str = Field(
        default="researchlens",
        description="MongoDB database name",
    )

    # Frontend
    FRONTEND_URL: str = Field(
        default="http://localhost:5173",
        description="Allowed frontend origin for CORS",
    )

    # Cache TTL Defaults
    CACHE_TTL_COUNTS_DAYS: int = Field(
        default=7,
        description="Cache TTL in days for domain/topic counts",
    )
    CACHE_TTL_PAPERS_HOURS: int = Field(
        default=24,
        description="Cache TTL in hours for paper queries",
    )

    # Development Mock flag
    DEV_MOCK: bool = Field(
        default=False,
        description="If True, permits mock data in local offline development",
    )


settings = Settings()