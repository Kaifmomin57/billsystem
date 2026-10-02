import logging
import urllib.parse
import base64
from typing import Optional, Dict, Any
import requests
from app.core.config import get_settings

logger = logging.getLogger("smartbill.whatsapp")


def clean_phone_number(phone_raw: Optional[str]) -> Optional[str]:
    """Cleans phone number to standard international format without +, spaces or symbols."""
    if not phone_raw:
        return None
    cleaned = "".join(ch for ch in str(phone_raw) if ch.isdigit())
    if not cleaned:
        return None
    # If 10-digit Indian number without country code, prepend 91
    if len(cleaned) == 10:
        cleaned = "91" + cleaned
    return cleaned


def check_openwa_status() -> Dict[str, Any]:
    """
    Checks the status and connectivity of the OpenWA WhatsApp Gateway.
    """
    settings = get_settings()
    base_url = (settings.OPENWA_BASE_URL or "http://localhost:2785").rstrip("/")
    session_id = settings.OPENWA_SESSION_ID or "default"
    
    headers = {}
    if settings.OPENWA_API_KEY:
        headers["X-API-Key"] = settings.OPENWA_API_KEY
        
    try:
        url = f"{base_url}/api/sessions/{session_id}"
        resp = requests.get(url, headers=headers, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            return {
                "online": True,
                "session": session_id,
                "status": data.get("status", "ready"),
                "details": data
            }
        else:
            return {
                "online": False,
                "status": f"HTTP {resp.status_code}",
                "error": resp.text
            }
    except Exception as e:
        return {
            "online": False,
            "status": "offline",
            "error": str(e)
        }


def send_via_openwa(
    phone: str,
    message: str,
    pdf_bytes: Optional[bytes] = None,
    pdf_url: Optional[str] = None,
    pdf_filename: Optional[str] = None
) -> Dict[str, Any]:
    """
    Sends WhatsApp message / PDF document directly using OpenWA Gateway.
    Repository: https://github.com/rmyndharis/OpenWA
    """
    settings = get_settings()
    cleaned_phone = clean_phone_number(phone)
    if not cleaned_phone:
        return {"success": False, "error": "Invalid phone number"}

    base_url = (settings.OPENWA_BASE_URL or "http://localhost:2785").rstrip("/")
    session_id = settings.OPENWA_SESSION_ID or "default"
    chat_id = f"{cleaned_phone}@c.us"
    filename = pdf_filename or "Invoice.pdf"

    headers = {"Content-Type": "application/json"}
    if settings.OPENWA_API_KEY:
        headers["X-API-Key"] = settings.OPENWA_API_KEY

    # 1. If PDF bytes or URL is present, send document endpoint
    if pdf_bytes or pdf_url:
        endpoint = f"{base_url}/api/sessions/{session_id}/messages/send-document"
        payload: Dict[str, Any] = {
            "chatId": chat_id,
            "filename": filename,
            "caption": message,
        }
        
        if pdf_bytes:
            # Base64 document dispatch (works without external cloud hosting)
            b64_str = base64.b64encode(pdf_bytes).decode("utf-8")
            payload["base64"] = b64_str
            payload["mimetype"] = "application/pdf"
        elif pdf_url:
            payload["url"] = pdf_url

        try:
            resp = requests.post(endpoint, json=payload, headers=headers, timeout=30)
            if resp.status_code in [200, 201]:
                return {
                    "success": True,
                    "provider": "openwa",
                    "mode": "openwa_document",
                    "response": resp.json() if resp.content else {}
                }
            else:
                logger.warning(f"OpenWA send-document returned HTTP {resp.status_code}: {resp.text}")
                # Fallback to text send if document format failed
        except Exception as e:
            logger.error(f"OpenWA document send error: {e}")
            return {"success": False, "provider": "openwa", "error": str(e)}

    # 2. Text message send endpoint
    text_endpoint = f"{base_url}/api/sessions/{session_id}/messages/send-text"
    text_payload = {
        "chatId": chat_id,
        "text": message
    }
    try:
        resp = requests.post(text_endpoint, json=text_payload, headers=headers, timeout=20)
        if resp.status_code in [200, 201]:
            return {
                "success": True,
                "provider": "openwa",
                "mode": "openwa_text",
                "response": resp.json() if resp.content else {}
            }
        else:
            return {
                "success": False,
                "provider": "openwa",
                "status_code": resp.status_code,
                "error": resp.text
            }
    except Exception as e:
        return {"success": False, "provider": "openwa", "error": str(e)}


def send_whatsapp_direct(
    phone: str,
    message: str,
    pdf_bytes: Optional[bytes] = None,
    pdf_url: Optional[str] = None,
    pdf_filename: Optional[str] = None
) -> Dict[str, Any]:
    """
    Unified WhatsApp dispatcher:
    1. Tries OpenWA (https://github.com/rmyndharis/OpenWA) if active / reachable.
    2. Tries Meta Official WhatsApp Cloud API if credentials exist.
    3. Tries Custom Gateway if configured.
    4. Falls back to prefilled wa.me click-to-chat link.
    """
    settings = get_settings()
    cleaned_phone = clean_phone_number(phone)
    if not cleaned_phone:
        return {"success": False, "error": "Invalid or missing phone number"}

    # 1. OpenWA Gateway
    if settings.OPENWA_BASE_URL:
        openwa_res = send_via_openwa(
            phone=cleaned_phone,
            message=message,
            pdf_bytes=pdf_bytes,
            pdf_url=pdf_url,
            pdf_filename=pdf_filename
        )
        if openwa_res.get("success"):
            return openwa_res
        else:
            logger.info(f"OpenWA attempt unsuccessful ({openwa_res.get('error')}), checking other options...")

    # 2. Meta Official WhatsApp Cloud API
    if settings.WHATSAPP_PHONE_NUMBER_ID and settings.WHATSAPP_ACCESS_TOKEN:
        url = f"https://graph.facebook.com/v19.0/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
        headers = {
            "Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}",
            "Content-Type": "application/json"
        }
        
        if pdf_url and pdf_url.startswith("http"):
            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": cleaned_phone,
                "type": "document",
                "document": {
                    "link": pdf_url,
                    "caption": message,
                    "filename": pdf_filename or "Bill_Invoice.pdf"
                }
            }
        else:
            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": cleaned_phone,
                "type": "text",
                "text": {"preview_url": True, "body": message}
            }

        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=15)
            if resp.status_code in [200, 201]:
                return {"success": True, "provider": "meta_cloud", "response": resp.json()}
            else:
                logger.error(f"Meta WhatsApp API error: {resp.text}")
        except Exception as e:
            logger.error(f"WhatsApp request failed: {e}")

    # 3. Custom Gateway API (UltraMsg / Waboxapp / etc)
    if settings.WHATSAPP_GATEWAY_URL:
        try:
            payload = {
                "to": cleaned_phone,
                "body": message,
                "pdf_url": pdf_url,
                "token": settings.WHATSAPP_GATEWAY_TOKEN
            }
            resp = requests.post(settings.WHATSAPP_GATEWAY_URL, json=payload, timeout=15)
            if resp.status_code in [200, 201]:
                return {"success": True, "provider": "custom_gateway", "response": resp.text}
        except Exception as e:
            logger.error(f"Custom Gateway error: {e}")

    # 4. Fallback Click-to-chat URL
    encoded_text = urllib.parse.quote(message)
    wa_url = f"https://wa.me/{cleaned_phone}?text={encoded_text}"
    return {
        "success": True,
        "mode": "click_to_chat",
        "phone": cleaned_phone,
        "whatsapp_url": wa_url,
        "message": "Click-to-chat ready. OpenWA gateway or Meta credentials can be configured for automatic background dispatch."
    }
