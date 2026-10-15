import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional
import httpx
from tenacity import (
    AsyncRetrying,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)
from app.config.settings import settings

logger = logging.getLogger("researchlens.http")


class OpenAlexUsageTracker:
    """Tracks OpenAlex API credit consumption and daily allowance."""

    def __init__(self):
        self.limit: Optional[int] = None
        self.remaining: Optional[int] = None
        self.credits_used: Optional[int] = None
        self.reset_seconds: Optional[int] = None
        self.last_updated: Optional[datetime] = None
        self.key_disabled: bool = False
        self.key_disabled_reason: Optional[str] = None

    def update_from_headers(self, headers: httpx.Headers):
        try:
            if "x-ratelimit-limit" in headers:
                self.limit = int(headers["x-ratelimit-limit"])
            if "x-ratelimit-remaining" in headers:
                self.remaining = int(headers["x-ratelimit-remaining"])
            if "x-ratelimit-credits-used" in headers:
                self.credits_used = int(headers["x-ratelimit-credits-used"])
            if "x-ratelimit-reset" in headers:
                self.reset_seconds = int(headers["x-ratelimit-reset"])
            self.last_updated = datetime.now(timezone.utc)
        except Exception as exc:
            logger.debug("Error parsing OpenAlex rate limit headers: %s", exc)

    def disable_key(self, reason: str = "budget_exhausted"):
        self.key_disabled = True
        self.key_disabled_reason = reason
        self.remaining = None
        self.limit = None

    def is_allowance_exhausted(self) -> bool:
        if self.remaining is None:
            return False
        # If reset time has passed, reset tracker
        if self.last_updated and self.reset_seconds:
            elapsed = (datetime.now(timezone.utc) - self.last_updated).total_seconds()
            if elapsed >= self.reset_seconds:
                self.remaining = None
                return False
        # If remaining is nearly zero or below 2% of limit
        if self.remaining <= 5:
            return True
        if self.limit and (self.remaining / self.limit) < 0.02:
            return True
        return False

    def reset(self):
        self.limit = None
        self.remaining = None
        self.credits_used = None
        self.reset_seconds = None
        self.last_updated = None
        self.key_disabled = False
        self.key_disabled_reason = None

    def get_status(self) -> Dict[str, Any]:
        return {
            "limit": self.limit,
            "remaining": self.remaining,
            "credits_used": self.credits_used,
            "reset_seconds": self.reset_seconds,
            "key_disabled": self.key_disabled,
            "is_exhausted": self.is_allowance_exhausted(),
            "last_updated": self.last_updated.isoformat() if self.last_updated else None,
        }


class OpenAlexQuotaExceededException(Exception):
    pass


class ArxivThrottler:
    """Enforces arXiv polite spacing (at least 3 seconds between consecutive requests)."""

    def __init__(self, delay_seconds: float = 3.0):
        self._delay = delay_seconds
        self._last_call = 0.0
        self._lock = asyncio.Lock()

    async def wait_turn(self):
        async with self._lock:
            elapsed = time.monotonic() - self._last_call
            if elapsed < self._delay:
                await asyncio.sleep(self._delay - elapsed)
            self._last_call = time.monotonic()


def _is_retryable_error(exc: BaseException) -> bool:
    if isinstance(exc, httpx.HTTPStatusError):
        # Retry on 429 and 5xx server errors
        return exc.response.status_code == 429 or exc.response.status_code >= 500
    if isinstance(exc, (httpx.ConnectError, httpx.ReadTimeout, httpx.ConnectTimeout)):
        return True
    return False


class SharedHttpClient:
    """Shared HTTP client with concurrency limits, exponential backoff, rate tracking, and polite delays."""

    def __init__(self, max_concurrency: int = 5, timeout: float = 30.0):
        self._semaphore = asyncio.Semaphore(max_concurrency)
        self._timeout = timeout
        self.openalex_tracker = OpenAlexUsageTracker()
        self.arxiv_throttler = ArxivThrottler(delay_seconds=3.0)
        self._client: Optional[httpx.AsyncClient] = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            headers = {
                "User-Agent": (
                    f"ResearchLens/1.0 ({settings.APP_NAME})"
                    + (f" mailto:{settings.CONTACT_EMAIL}" if settings.CONTACT_EMAIL else "")
                )
            }
            self._client = httpx.AsyncClient(timeout=self._timeout, headers=headers)
        return self._client

    def reset_tracker(self):
        self.openalex_tracker.reset()

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def get(
        self,
        url: str,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = None,
    ) -> httpx.Response:
        is_arxiv = "export.arxiv.org" in url or "arxiv.org" in url
        is_openalex = "api.openalex.org" in url

        if is_openalex and self.openalex_tracker.is_allowance_exhausted():
            logger.warning("OpenAlex daily quota nearly exhausted. Halting live calls.")
            raise OpenAlexQuotaExceededException(
                "OpenAlex daily allowance nearly exhausted. Serving cached data."
            )

        if is_arxiv:
            await self.arxiv_throttler.wait_turn()

        client = self._get_client()
        req_headers = dict(headers or {})
        req_params = dict(params or {})

        # OpenAlex polite pool configuration
        if is_openalex and settings.CONTACT_EMAIL and "mailto" not in req_params:
            req_params["mailto"] = settings.CONTACT_EMAIL

        # OpenAlex authentication headers & query param (only if key is not disabled)
        use_openalex_key = bool(
            is_openalex
            and settings.OPENALEX_API_KEY
            and not self.openalex_tracker.key_disabled
        )
        if use_openalex_key:
            if "api_key" not in req_headers:
                req_headers["api_key"] = settings.OPENALEX_API_KEY
            if "Authorization" not in req_headers:
                req_headers["Authorization"] = f"Bearer {settings.OPENALEX_API_KEY}"
            if "api_key" not in req_params:
                req_params["api_key"] = settings.OPENALEX_API_KEY

        # Semantic scholar key header
        if (
            "semanticscholar.org" in url
            and settings.SEMANTIC_SCHOLAR_API_KEY
            and "x-api-key" not in req_headers
        ):
            req_headers["x-api-key"] = settings.SEMANTIC_SCHOLAR_API_KEY

        async with self._semaphore:
            async for attempt in AsyncRetrying(
                stop=stop_after_attempt(3),
                wait=wait_exponential(multiplier=1.0, min=1.0, max=8.0),
                retry=retry_if_exception(_is_retryable_error),
                reraise=True,
            ):
                with attempt:
                    response = await client.get(
                        url,
                        params=req_params,
                        headers=req_headers,
                        timeout=timeout or self._timeout,
                    )
                    if is_openalex:
                        # Check for 429 Insufficient Budget / rate limit on API key
                        if response.status_code == 429 and ("api_key" in req_params or "api_key" in req_headers):
                            body_snippet = response.text.lower()
                            if "budget" in body_snippet or "credit" in body_snippet or "rate limit" in body_snippet:
                                logger.warning(
                                    "OpenAlex API key budget exhausted. Automatically falling back to OpenAlex Polite Pool (100k requests/day free via mailto)."
                                )
                                self.openalex_tracker.disable_key("budget_exhausted")
                                req_headers.pop("api_key", None)
                                req_headers.pop("Authorization", None)
                                req_params.pop("api_key", None)
                                # Retry immediately in polite pool
                                response = await client.get(
                                    url,
                                    params=req_params,
                                    headers=req_headers,
                                    timeout=timeout or self._timeout,
                                )
                        self.openalex_tracker.update_from_headers(response.headers)
                    response.raise_for_status()
                    return response


http_client = SharedHttpClient()
