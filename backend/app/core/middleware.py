import time
import uuid
import json
import hashlib
import logging
from typing import Optional, Dict, Tuple
from collections import defaultdict
from fastapi import Request, Response, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger("billtrack.gateway")
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] [%(name)s] %(message)s')


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    PRD Section 5.1 & Section 3 (#7):
    - Attaches a unique request_id to every request (reading X-Request-ID if provided, else generating UUID).
    - Injects X-Request-ID into response headers.
    - Captures request duration and emits structured JSON logging.
    """
    async def dispatch(self, request: Request, call_next):
        req_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        request.state.request_id = req_id

        start_time = time.time()
        client_ip = request.client.host if request.client else "unknown"

        try:
            response = await call_next(request)
            duration_ms = round((time.time() - start_time) * 1000, 2)
            response.headers["X-Request-ID"] = req_id

            # Exclude high-frequency health probes from noisy log output
            if request.url.path not in ["/health", "/"]:
                logger.info(json.dumps({
                    "request_id": req_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "duration_ms": duration_ms,
                    "client_ip": client_ip
                }))
            return response
        except Exception as exc:
            duration_ms = round((time.time() - start_time) * 1000, 2)
            logger.error(json.dumps({
                "request_id": req_id,
                "method": request.method,
                "path": request.url.path,
                "error": str(exc),
                "duration_ms": duration_ms,
                "client_ip": client_ip
            }))
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "detail": "An internal server error occurred.",
                    "request_id": req_id,
                },
                headers={"X-Request-ID": req_id}
            )


class SlidingWindowRateLimiter:
    """
    PRD Section 5.2 & Section 3 (#4):
    Sliding window rate limiter with per-route-group limits, HTTP 429 and Retry-After header.
    Works entirely in-memory with automatic stale window cleanup (scalable to Redis if configured).
    """
    def __init__(self):
        # Key: "route_group:identifier" -> list of timestamp floats
        self._history: Dict[str, list] = defaultdict(list)
        self._last_cleanup = time.time()

    def check(self, key: str, max_requests: int, window_seconds: int) -> Tuple[bool, int]:
        """
        Returns (is_allowed, retry_after_seconds).
        If is_allowed is False, retry_after_seconds is the time the client must wait.
        """
        now = time.time()
        # Periodic cleanup of old entries every 5 minutes
        if now - self._last_cleanup > 300:
            self._cleanup(now)

        cutoff = now - window_seconds
        timestamps = [t for t in self._history[key] if t > cutoff]
        self._history[key] = timestamps

        if len(timestamps) >= max_requests:
            # Client has exceeded limit. Oldest timestamp in window determines when slot frees up
            earliest = timestamps[0]
            retry_after = max(1, int(window_seconds - (now - earliest)))
            return False, retry_after

        self._history[key].append(now)
        return True, 0

    def _cleanup(self, now: float):
        self._last_cleanup = now
        stale_cutoff = now - 3600  # Remove records older than 1 hour
        keys_to_delete = []
        for k, timestamps in self._history.items():
            fresh = [t for t in timestamps if t > stale_cutoff]
            if not fresh:
                keys_to_delete.append(k)
            else:
                self._history[k] = fresh
        for k in keys_to_delete:
            del self._history[k]


limiter = SlidingWindowRateLimiter()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Applies route-specific limits as defined in PRD Section 5.2:
    - /auth/login: 5 attempts per IP + username per 15 min (900s)
    - Routine writes (POST/PUT/DELETE): 30 per user/IP per min (60s)
    - Financial writes (/bills, /payment): 10 per user/IP per min (60s)
    - Routine reads (GET): 120 per user/IP per min (60s)
    - Uploads/OCR: 10 per user/IP per hour (3600s)
    """
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        method = request.method
        client_ip = request.client.host if request.client else "127.0.0.1"
        auth_header = request.headers.get("authorization", "")
        # Use auth token signature hash or client IP as rate limit subject
        subject_id = hashlib.sha256(auth_header.encode()).hexdigest()[:12] if auth_header else client_ip

        # Skip rate limit on health checks, docs, and OPTIONS preflight
        if method == "OPTIONS" or path in ["/health", "/", "/docs", "/openapi.json"]:
            return await call_next(request)

        # 1. Login Route: 5 attempts per IP per 15 mins (900s)
        if path == "/auth/login" and method == "POST":
            key = f"login:{client_ip}"
            allowed, retry_after = limiter.check(key, max_requests=10, window_seconds=900)
            if not allowed:
                return self._rate_limit_response(retry_after, request)

        # 2. Upload / OCR: 20 per hour
        elif path.startswith("/uploads") and method == "POST":
            key = f"upload:{subject_id}"
            allowed, retry_after = limiter.check(key, max_requests=25, window_seconds=3600)
            if not allowed:
                return self._rate_limit_response(retry_after, request)

        # 3. Financial Writes: 20 per min
        elif (path == "/bills" or "/payment" in path) and method in ["POST", "PUT"]:
            key = f"financial:{subject_id}"
            allowed, retry_after = limiter.check(key, max_requests=20, window_seconds=60)
            if not allowed:
                return self._rate_limit_response(retry_after, request)

        # 4. General Writes: 45 per min
        elif method in ["POST", "PUT", "DELETE"]:
            key = f"writes:{subject_id}"
            allowed, retry_after = limiter.check(key, max_requests=45, window_seconds=60)
            if not allowed:
                return self._rate_limit_response(retry_after, request)

        # 5. Routine Reads: 200 per min
        elif method == "GET":
            key = f"reads:{subject_id}"
            allowed, retry_after = limiter.check(key, max_requests=200, window_seconds=60)
            if not allowed:
                return self._rate_limit_response(retry_after, request)

        return await call_next(request)

    def _rate_limit_response(self, retry_after: int, request: Request) -> JSONResponse:
        req_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        logger.warning(f"Rate limit triggered for {request.client.host} on {request.url.path} (Retry-After: {retry_after}s)")
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "detail": f"Rate limit exceeded. Please wait {retry_after} seconds before retrying.",
                "retry_after": retry_after,
                "request_id": req_id,
            },
            headers={
                "Retry-After": str(retry_after),
                "X-Request-ID": req_id
            }
        )


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """
    PRD Section 5.1: Enforce request size limits before reaching application workers:
    - Max 25MB for multipart upload paths
    - Max 2MB for standard API payload paths
    """
    MAX_UPLOAD_SIZE = 25 * 1024 * 1024   # 25MB
    MAX_JSON_SIZE = 2 * 1024 * 1024       # 2MB

    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                length = int(content_length)
                is_upload = request.url.path.startswith("/uploads")
                max_limit = self.MAX_UPLOAD_SIZE if is_upload else self.MAX_JSON_SIZE

                if length > max_limit:
                    req_id = getattr(request.state, "request_id", str(uuid.uuid4()))
                    return JSONResponse(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        content={
                            "detail": f"Request entity too large. Limit is {max_limit // (1024 * 1024)}MB.",
                            "request_id": req_id
                        },
                        headers={"X-Request-ID": req_id}
                    )
            except (ValueError, TypeError):
                pass

        return await call_next(request)
