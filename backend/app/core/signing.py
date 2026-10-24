import time
import hmac
import hashlib
from typing import Optional
from fastapi import HTTPException, status
from app.core.config import get_settings

settings = get_settings()


def generate_signed_url(file_path: str, expires_in_seconds: int = 900) -> str:
    """
    PRD Section 9: Generates a time-limited signed URL token for private file access.
    Default expiry is 15 minutes (900 seconds).
    """
    clean_path = file_path.strip().lstrip("/").replace("\\", "/")
    expires_at = int(time.time()) + expires_in_seconds
    signature_data = f"{clean_path}:{expires_at}:{settings.SECRET_KEY}".encode("utf-8")
    sig = hmac.new(settings.SECRET_KEY.encode("utf-8"), signature_data, hashlib.sha256).hexdigest()[:32]
    return f"/secure-media/{clean_path}?expires={expires_at}&sig={sig}"


def verify_signed_url(file_path: str, expires: int, sig: str) -> bool:
    """
    Validates HMAC signature and verifies that the URL has not expired.
    """
    now = int(time.time())
    if now > expires:
        return False

    clean_path = file_path.strip().lstrip("/").replace("\\", "/")
    expected_data = f"{clean_path}:{expires}:{settings.SECRET_KEY}".encode("utf-8")
    expected_sig = hmac.new(settings.SECRET_KEY.encode("utf-8"), expected_data, hashlib.sha256).hexdigest()[:32]
    return hmac.compare_digest(sig, expected_sig)
