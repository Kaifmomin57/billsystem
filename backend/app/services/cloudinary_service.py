import os
import logging
from typing import Optional, Dict, Any
import cloudinary
import cloudinary.uploader
from app.core.config import get_settings

logger = logging.getLogger("smartbill.cloudinary")

def is_cloudinary_configured() -> bool:
    settings = get_settings()
    return bool(
        settings.CLOUDINARY_CLOUD_NAME and 
        settings.CLOUDINARY_API_SECRET and 
        settings.CLOUDINARY_API_KEY
    )

def configure_cloudinary():
    settings = get_settings()
    if is_cloudinary_configured():
        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True
        )

def upload_image_to_cloudinary(file_path_or_bytes, folder: str = "smartbill_ledgers", public_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Uploads an image file or bytes to Cloudinary.
    Returns a dict containing 'secure_url', 'public_id', etc. or None if failed.
    """
    if not is_cloudinary_configured():
        logger.warning("Cloudinary is not fully configured (needs CLOUDINARY_API_KEY). Skipping Cloudinary upload.")
        return None

    try:
        configure_cloudinary()
        kwargs = {
            "folder": folder,
            "resource_type": "auto",
            "overwrite": True
        }
        if public_id:
            kwargs["public_id"] = public_id
        response = cloudinary.uploader.upload(
            file_path_or_bytes,
            **kwargs
        )
        logger.info(f"Uploaded to Cloudinary successfully: {response.get('secure_url')}")
        return response
    except Exception as e:
        logger.error(f"Cloudinary upload error: {e}")
        return None
