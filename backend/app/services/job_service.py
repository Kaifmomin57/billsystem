import uuid
import json
import logging
import time
from typing import Optional, Dict, Any, Callable
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from app.core.database import SessionLocal
from app.models.models import BackgroundJob

logger = logging.getLogger("billtrack.jobs")
executor = ThreadPoolExecutor(max_workers=4)


def create_job(job_type: str, payload: Dict[str, Any], user_id: Optional[int] = None) -> str:
    """Creates a durable background job record in DB and returns the job_id."""
    job_id = str(uuid.uuid4())
    db = SessionLocal()
    try:
        job = BackgroundJob(
            id=job_id,
            user_id=user_id,
            job_type=job_type,
            status="queued",
            progress=0,
            progress_message="Job queued, awaiting worker…",
            payload=json.dumps(payload),
            created_at=datetime.now(timezone.utc)
        )
        db.add(job)
        db.commit()
        return job_id
    finally:
        db.close()


def update_job_progress(job_id: str, progress: int, message: str, status: str = "processing"):
    """Updates progress (0-100) and user-facing status message."""
    db = SessionLocal()
    try:
        job = db.query(BackgroundJob).filter(BackgroundJob.id == job_id).first()
        if job:
            job.progress = progress
            job.progress_message = message
            job.status = status
            job.updated_at = datetime.now(timezone.utc)
            db.commit()
    except Exception as e:
        logger.error(f"Failed to update job {job_id} progress: {e}")
    finally:
        db.close()


def complete_job(job_id: str, result_data: Dict[str, Any], status: str = "completed"):
    """Marks job completed with serialized result payload."""
    db = SessionLocal()
    try:
        job = db.query(BackgroundJob).filter(BackgroundJob.id == job_id).first()
        if job:
            job.progress = 100
            job.progress_message = "Completed successfully."
            job.status = status
            job.result = json.dumps(result_data, default=str)
            job.completed_at = datetime.now(timezone.utc)
            job.updated_at = datetime.now(timezone.utc)
            db.commit()
    except Exception as e:
        logger.error(f"Failed to complete job {job_id}: {e}")
    finally:
        db.close()


def fail_job(job_id: str, error_message: str):
    """Marks job failed with safe error summary and timestamp."""
    db = SessionLocal()
    try:
        job = db.query(BackgroundJob).filter(BackgroundJob.id == job_id).first()
        if job:
            job.status = "failed"
            job.error_message = error_message[:1000]
            job.progress_message = f"Failed: {error_message[:100]}"
            job.completed_at = datetime.now(timezone.utc)
            job.updated_at = datetime.now(timezone.utc)
            db.commit()
    except Exception as e:
        logger.error(f"Failed to fail job {job_id}: {e}")
    finally:
        db.close()


def run_async_task(job_id: str, task_fn: Callable[[str], Any]):
    """Dispatches a task function to the thread pool with execution wrapper."""
    def _wrapper():
        logger.info(f"Starting background job execution: {job_id}")
        update_job_progress(job_id, 5, "Worker started processing…")
        try:
            task_fn(job_id)
        except Exception as e:
            logger.exception(f"Unhandled exception in background job {job_id}: {e}")
            fail_job(job_id, str(e))

    executor.submit(_wrapper)
