import pytest
import httpx
from app.services.cache import cache_service
from app.services.http_client import OpenAlexUsageTracker


@pytest.mark.asyncio
async def test_cache_set_and_get():
    cache_service.clear_memory()

    key_payload = {"test": 123, "topic": "vision"}
    val = {"result": "success", "count": 42}

    # Miss before set
    cached = await cache_service.get("test_prefix", key_payload)
    assert cached is None

    # Set in cache
    await cache_service.set("test_prefix", key_payload, val, ttl_seconds=60)

    # Hit after set
    hit = await cache_service.get("test_prefix", key_payload)
    assert hit == val


def test_openalex_usage_tracker():
    tracker = OpenAlexUsageTracker()
    assert tracker.is_allowance_exhausted() is False

    headers = httpx.Headers(
        {
            "x-ratelimit-limit": "100000",
            "x-ratelimit-remaining": "95000",
            "x-ratelimit-credits-used": "1",
            "x-ratelimit-reset": "43200",
        }
    )
    tracker.update_from_headers(headers)
    assert tracker.limit == 100000
    assert tracker.remaining == 95000
    assert tracker.is_allowance_exhausted() is False

    # Low credits triggers exhaustion
    low_headers = httpx.Headers(
        {
            "x-ratelimit-limit": "100000",
            "x-ratelimit-remaining": "40",
            "x-ratelimit-credits-used": "1",
            "x-ratelimit-reset": "3600",
        }
    )
    tracker.update_from_headers(low_headers)
    assert tracker.remaining == 40
    assert tracker.is_allowance_exhausted() is True
