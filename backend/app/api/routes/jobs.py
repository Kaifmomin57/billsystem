import json
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import BackgroundJob, User

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _format_job(job: BackgroundJob) -> Dict[str, Any]:
    parsed_result = None
    if job.result:
        try:
            parsed_result = json.loads(job.result)
        except Exception:
            parsed_result = job.result

    return {
        "job_id": job.id,
        "job_type": job.job_type,
        "status": job.status,
        "progress": job.progress,
        "progress_message": job.progress_message,
        "result": parsed_result,
        "error_message": job.error_message,
        "attempts": job.attempts,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "updated_at": job.updated_at.isoformat() if job.updated_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
    }


@router.get("/{job_id}")
def get_job_status(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    PRD Section 7: Poll status of an asynchronous background job.
    Returns current state (queued, processing, needs_review, completed, failed) and progress percentage.
    """
    job = db.query(BackgroundJob).filter(BackgroundJob.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found."
        )
    return _format_job(job)


@router.get("")
def list_jobs(
    limit: int = 20,
    job_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List recent background jobs for the authenticated user."""
    query = db.query(BackgroundJob).order_by(BackgroundJob.created_at.desc())
    if job_type:
        query = query.filter(BackgroundJob.job_type == job_type)
    jobs = query.limit(limit).all()
    return [_format_job(j) for j in jobs]
