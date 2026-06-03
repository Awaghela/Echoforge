import time
from collections import defaultdict, deque
from fastapi import HTTPException, Request

# Lightweight in-memory limiter for a POC. For production, replace with Redis/token bucket.
WINDOW_SECONDS = 60
MAX_REQUESTS_PER_WINDOW = 20
_hits: dict[str, deque[float]] = defaultdict(deque)


def rate_limit(request: Request) -> None:
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    bucket = _hits[client_ip]

    while bucket and bucket[0] < now - WINDOW_SECONDS:
        bucket.popleft()

    if len(bucket) >= MAX_REQUESTS_PER_WINDOW:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Please wait a moment and try again.",
        )

    bucket.append(now)
