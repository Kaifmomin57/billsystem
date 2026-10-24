import json
import hashlib
from typing import Optional, Any, Callable
from fastapi import Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from app.models.models import IdempotencyRecord


def check_and_save_idempotency(
    db: Session,
    key: Optional[str],
    route: str,
    payload_dict: Any,
    execute_fn: Callable[[], Any],
    user_id: Optional[int] = None
) -> Any:
    """
    PRD Section 6: Idempotency for financial writes.
    - If no key provided, executes normally (backward-compatible).
    - If key provided:
      - Hashes normalized payload JSON.
      - Checks database for existing key.
      - If found with same hash: returns cached response without running execute_fn.
      - If found with different hash: raises 409 Conflict.
      - If new: runs execute_fn, stores response in idempotency_keys table, and returns result.
    """
    if not key or not key.strip():
        return execute_fn()

    key = key.strip()
    raw_payload_str = json.dumps(payload_dict, sort_keys=True, default=str)
    request_hash = hashlib.sha256(raw_payload_str.encode("utf-8")).hexdigest()

    existing = db.query(IdempotencyRecord).filter(IdempotencyRecord.key == key).first()
    if existing:
        if existing.request_hash == request_hash:
            # Replay original result
            try:
                cached_body = json.loads(existing.response_body)
            except Exception:
                cached_body = existing.response_body

            headers = {"X-Cache-Lookup": "HIT"}
            if existing.response_headers:
                try:
                    for h_k, h_v in json.loads(existing.response_headers).items():
                        headers[h_k] = h_v
                except Exception:
                    pass
            headers["X-Idempotent-Replay"] = "true"
            return JSONResponse(status_code=existing.status_code, content=cached_body, headers=headers)
        else:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Idempotency key '{key}' was previously used with a different request payload. Cannot process conflicting write."
            )

    # Key is new: execute financial write
    result = execute_fn()

    # Serialize result for caching
    try:
        if hasattr(result, "model_dump"):
            body_dict = result.model_dump(mode="json")
        elif hasattr(result, "dict"):
            body_dict = result.dict()
        elif isinstance(result, (dict, list)):
            body_dict = result
        else:
            body_dict = {"status": "success"}
    except Exception:
        body_dict = {"status": "success"}

    serialized_body = json.dumps(body_dict, default=str)

    idemp_rec = IdempotencyRecord(
        key=key,
        user_id=user_id,
        route=route,
        request_hash=request_hash,
        status_code=200,
        response_headers=json.dumps({"Content-Type": "application/json"}),
        response_body=serialized_body
    )
    db.add(idemp_rec)
    db.commit()

    return result
