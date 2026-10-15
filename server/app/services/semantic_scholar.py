# Re-export semantic_scholar_adapter as semantic_scholar_service for backward compatibility
from app.services.semantic_scholar_adapter import (
    SemanticScholarAdapter,
    semantic_scholar_adapter,
)

semantic_scholar_service = semantic_scholar_adapter
SemanticScholarService = SemanticScholarAdapter

__all__ = ["semantic_scholar_service", "SemanticScholarService", "semantic_scholar_adapter"]