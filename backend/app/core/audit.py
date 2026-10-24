import json
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.models import AuditLog

logger = logging.getLogger("billtrack.audit")


def record_audit(
    db: Session,
    action: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    user_id: Optional[int] = None,
    changes: Optional[Dict[str, Any]] = None,
    request_id: Optional[str] = None,
    ip_address: Optional[str] = None
) -> Optional[AuditLog]:
    """
    PRD Section 9: Records an audit trail entry for critical business and financial actions.
    Automatically redacts sensitive credentials if present in changes.
    """
    try:
        sanitized_changes = None
        if changes:
            # Redact passwords or secret keys
            clean = dict(changes)
            for k in list(clean.keys()):
                if "password" in k.lower() or "secret" in k.lower() or "token" in k.lower():
                    clean[k] = "[REDACTED]"
            sanitized_changes = json.dumps(clean, default=str)

        log = AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            changes=sanitized_changes,
            request_id=request_id,
            ip_address=ip_address,
            created_at=datetime.now(timezone.utc)
        )
        db.add(log)
        db.commit()
        return log
    except Exception as e:
        logger.error(f"Failed to record audit log for {action} on {entity_type}: {e}")
        return None
