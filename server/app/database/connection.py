import logging
import time
from typing import Optional
from pymongo import MongoClient
from app.config.settings import settings

logger = logging.getLogger("researchlens.database")

_client: Optional[MongoClient] = None
_last_check_time: float = 0.0
_is_connected: bool = False


def get_mongo_client() -> MongoClient:
    global _client
    if _client is None:
        _client = MongoClient(
            settings.MONGODB_URI,
            serverSelectionTimeoutMS=2000,
        )
    return _client


def get_database():
    client = get_mongo_client()
    return client[settings.MONGODB_DATABASE]


def check_database_connection(force: bool = False) -> bool:
    """Check connectivity to MongoDB with a short timeout and cached health check to avoid repeated timeouts."""
    global _last_check_time, _is_connected
    now = time.monotonic()
    if not force and (now - _last_check_time < 30.0):
        return _is_connected

    _last_check_time = now
    try:
        client = get_mongo_client()
        client.admin.command("ping")
        _is_connected = True
        logger.info("Successfully connected to MongoDB (%s)", settings.MONGODB_DATABASE)
        return True
    except Exception as exc:
        _is_connected = False
        logger.warning(
            "MongoDB is not currently reachable at %s (%s). Using in-memory store fallback.",
            settings.MONGODB_URI,
            exc,
        )
        return False


def is_database_available() -> bool:
    return check_database_connection(force=False)