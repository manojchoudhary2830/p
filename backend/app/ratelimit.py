import time
from collections import defaultdict
from typing import Dict, List
from fastapi import HTTPException, Request, status

class InMemoryRateLimiter:
    """
    Sliding-window rate limiter for sensitive authentication endpoints
    (applied to login & forgot-password per security audit in p.md)
    """
    def __init__(self, requests_limit: int = 5, window_seconds: int = 60):
        self.requests_limit = requests_limit
        self.window_seconds = window_seconds
        # key -> list of timestamps
        self.history: Dict[str, List[float]] = defaultdict(list)

    def is_allowed(self, key: str) -> bool:
        now = time.time()
        cutoff = now - self.window_seconds

        # Evict old records
        self.history[key] = [t for t in self.history[key] if t > cutoff]

        if len(self.history[key]) >= self.requests_limit:
            return False

        self.history[key].append(now)
        return True

    def get_remaining_seconds(self, key: str) -> int:
        now = time.time()
        cutoff = now - self.window_seconds
        timestamps = [t for t in self.history[key] if t > cutoff]
        if not timestamps:
            return 0
        oldest = min(timestamps)
        remaining = int(self.window_seconds - (now - oldest))
        return max(remaining, 1)

    def check(self, identifier: str):
        if not self.is_allowed(identifier):
            retry_after = self.get_remaining_seconds(identifier)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many attempts. Please try again in {retry_after} seconds.",
                headers={"Retry-After": str(retry_after)},
            )


# Global rate limiter instances:
# 5 login attempts per minute per IP / email
login_limiter = InMemoryRateLimiter(requests_limit=5, window_seconds=60)

# 3 password reset requests per 10 minutes per IP / email
forgot_password_limiter = InMemoryRateLimiter(requests_limit=3, window_seconds=600)


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


def rate_limit_login(request: Request, identifier: str = ""):
    ip = get_client_ip(request)
    key = f"login:{ip}:{identifier.lower()}" if identifier else f"login:{ip}"
    login_limiter.check(key)


def rate_limit_forgot_password(request: Request, email: str = ""):
    ip = get_client_ip(request)
    key = f"forgot:{ip}:{email.lower()}" if email else f"forgot:{ip}"
    forgot_password_limiter.check(key)
