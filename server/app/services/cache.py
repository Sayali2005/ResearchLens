import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Tuple
from app.config.settings import settings
from app.database.connection import get_database, is_database_available

logger = logging.getLogger("researchlens.cache")


class CacheService:
    def __init__(self):
        self._memory_cache: dict[str, Tuple[Any, datetime]] = {}
        self._indexes_created = False

    def _generate_key(self, prefix: str, payload: Any) -> str:
        serialized = json.dumps(payload, sort_keys=True, default=str)
        hashed = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
        return f"{prefix}:{hashed}"

    def _ensure_indexes(self, collection):
        if self._indexes_created:
            return
        try:
            collection.create_index("key", unique=True)
            collection.create_index("expires_at", expireAfterSeconds=0)
            self._indexes_created = True
        except Exception as exc:
            logger.debug("Could not ensure MongoDB cache indexes: %s", exc)

    async def get(self, prefix: str, payload: Any) -> Optional[Any]:
        key = self._generate_key(prefix, payload)
        now = datetime.now(timezone.utc)

        # 1. Try Memory Cache
        if key in self._memory_cache:
            data, expires_at = self._memory_cache[key]
            if now < expires_at:
                logger.debug("Cache hit (memory): %s", key)
                return data
            del self._memory_cache[key]

        # 2. Try MongoDB api_cache only if DB is available
        if is_database_available():
            try:
                db = get_database()
                collection = db["api_cache"]
                self._ensure_indexes(collection)
                doc = collection.find_one({"key": key})
                if doc:
                    expires_at = doc.get("expires_at")
                    if expires_at:
                        if expires_at.tzinfo is None:
                            expires_at = expires_at.replace(tzinfo=timezone.utc)
                        if now < expires_at:
                            logger.debug("Cache hit (mongodb): %s", key)
                            return doc.get("response")
                    collection.delete_one({"key": key})
            except Exception as exc:
                logger.debug("Cache read failed from MongoDB, continuing: %s", exc)

        return None

    async def set(
        self,
        prefix: str,
        payload: Any,
        data: Any,
        ttl_seconds: Optional[int] = None,
    ) -> None:
        if ttl_seconds is None:
            if "counts" in prefix:
                ttl_seconds = settings.CACHE_TTL_COUNTS_DAYS * 86400
            else:
                ttl_seconds = settings.CACHE_TTL_PAPERS_HOURS * 3600

        key = self._generate_key(prefix, payload)
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(seconds=ttl_seconds)

        # 1. Always save in memory
        self._memory_cache[key] = (data, expires_at)

        # 2. Save in MongoDB if available
        if is_database_available():
            try:
                db = get_database()
                collection = db["api_cache"]
                self._ensure_indexes(collection)
                collection.update_one(
                    {"key": key},
                    {
                        "$set": {
                            "key": key,
                            "response": data,
                            "created_at": now,
                            "expires_at": expires_at,
                        }
                    },
                    upsert=True,
                )
            except Exception as exc:
                logger.debug("Cache write failed to MongoDB, kept in memory: %s", exc)

    def clear_memory(self):
        self._memory_cache.clear()
        if is_database_available():
            try:
                db = get_database()
                db["api_cache"].delete_many({})
            except Exception as exc:
                logger.debug("Failed to clear MongoDB cache: %s", exc)
        try:
            from app.services.http_client import http_client
            http_client.reset_tracker()
        except Exception:
            pass


cache_service = CacheService()
