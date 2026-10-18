import json
import base64
import time
import urllib.request
import urllib.error
import logging
from typing import Dict, Any, Tuple

from app.core.config import get_settings

logger = logging.getLogger("gemini_analyzer")
settings = get_settings()

MODELS = [
    "gemini-3.1-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-3-flash-preview",
]

LEDGER_PROMPT = """You are an expert document AI parsing a handwritten Indian business ledger page.
Analyze the image and return ONLY valid JSON matching exactly this schema:

{
  "page_date": "YYYY-MM-DD or raw date string from page",
  "column_codes": ["M", "R", "B", "P", "K", "T", "JB"],
  "rows": [
    {
      "customer_name_raw": "Patil",
      "cells": {
        "M": {"quantity": 6.5, "rate": null, "tag": null, "circled_value": null, "is_live": false, "struck_out": false, "raw_text": "6.5", "confidence": 0.95},
        "R": {"quantity": 8.4, "rate": 12.2, "tag": null, "circled_value": null, "is_live": false, "struck_out": false, "raw_text": "8.4", "confidence": 0.95},
        "B": {"quantity": null, "rate": null, "tag": null, "circled_value": null, "is_live": false, "struck_out": false, "raw_text": "", "confidence": 0.95},
        "P": {"quantity": 7.0, "rate": null, "tag": null, "circled_value": "7", "is_live": true, "struck_out": false, "raw_text": "(7)", "confidence": 0.95},
        "K": {"quantity": 3.6, "rate": null, "tag": "mi", "circled_value": null, "is_live": false, "struck_out": false, "raw_text": "3.6 mi", "confidence": 0.95},
        "T": {"quantity": 40.0, "rate": null, "tag": null, "circled_value": "40", "is_live": true, "struck_out": false, "raw_text": "(40)", "confidence": 0.95},
        "JB": {"quantity": null, "rate": null, "tag": null, "circled_value": null, "is_live": false, "struck_out": false, "raw_text": "", "confidence": 0.95}
      }
    }
  ]
}

Rules:
1. ALWAYS extract the customer name written in the 'NAME' / 'नाम' / left column for every row into `customer_name_raw` (e.g. Patil, Irfan, Baba, Manoj, Ramvir, Vikas, Rashid, Vaishali, Gopi, Somchand, Jami, Hafiz, Sharik, etc.). Never leave `customer_name_raw` empty.
2. Read the top header row of the table grid carefully. Identify ALL column header codes (e.g., M, R, B, P, K, T, JB and any other column code).
3. Extract ALL customer rows visible on the page. For every single customer row, include a cell entry for every header column.
4. For fraction notation (e.g. 39 over 50), set quantity=39, rate=50.
5. Capture suffix letters (pd, mi, N, B, R, k, K, T, JB) as tag.
6. CIRCLED NUMBERS = LIVE FISH (CRITICAL):
   - In Indian fish trading ledgers, any number written inside a handwritten drawn circle, oval, ring, or parentheses (e.g. ⊚40, (40), circled 7 in red ink, circled 80 in red, circled 60, circled 100) indicates LIVE FISH (जिंदा / जीवंत मछली).
   - The circled number IS THE QUANTITY! Set `quantity` to that numeric value (e.g. 40.0, 7.0, 80.0, 60.0, 100.0).
   - Set `is_live`: true.
   - Set `circled_value`: string of that number (e.g. "40").
   - Set `raw_text`: e.g. "(40)" or "circled 40".
   - If a cell has both a normal number and a circled number (e.g. "15 (100)"), the circled number is live fish: set `quantity`: 100.0, `is_live`: true, `circled_value`: "100".
7. Crossed-out / struck-out values → struck_out: true, use the corrected value.
8. Confidence: 0.0-1.0 per cell (below 0.7 = yellow flag, below 0.4 = red flag).
9. If date not readable, set page_date to null.
Return ONLY the raw JSON object with no markdown or explanation."""

BILL_PROMPT = """Extract all bill details from this receipt or invoice image and return ONLY valid JSON:
{
  "vendor": {"name": null, "address": null, "phone": null, "tax_id": null},
  "invoice": {"number": null, "date": null, "currency_symbol": "₹"},
  "customer": {"name": null},
  "items": [{"description": "", "quantity": 1.0, "unit_price": 0.0, "discount": 0.0, "total": 0.0, "tag": null}],
  "financials": {"subtotal": 0.0, "tax_total": 0.0, "discount_total": 0.0, "grand_total": 0.0},
  "payment": {"method": null, "status": "Paid"}
}
All numeric values must be floats. Return ONLY the raw JSON object."""


def _clean_json(raw: str) -> Any:
    txt = raw.strip()
    if txt.startswith("```json"): txt = txt[7:]
    elif txt.startswith("```"): txt = txt[3:]
    if txt.endswith("```"): txt = txt[:-3]
    return json.loads(txt.strip())


def analyze_image(image_bytes: bytes, mime_type: str = "image/jpeg", upload_type: str = "ledger") -> Tuple[Dict, Dict]:
    """Analyze a bill/ledger image using Gemini with key rotation and model fallback."""
    api_keys = settings.gemini_api_keys
    if not api_keys:
        raise RuntimeError("No Gemini API keys configured in .env")

    img_b64 = base64.b64encode(image_bytes).decode("utf-8")
    prompt = LEDGER_PROMPT if upload_type == "ledger" else BILL_PROMPT
    last_error = None
    start = time.time()

    for model in MODELS:
        for key_idx, api_key in enumerate(api_keys):
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            payload = json.dumps({
                "contents": [{"parts": [{"text": prompt}, {"inline_data": {"mime_type": mime_type, "data": img_b64}}]}],
                "generationConfig": {"response_mime_type": "application/json", "temperature": 0.1}
            }).encode("utf-8")
            req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
            try:
                logger.info(f"Trying model={model}, key_idx={key_idx}")
                with urllib.request.urlopen(req, timeout=35) as resp:
                    data = json.loads(resp.read().decode())
                    raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
                    parsed = _clean_json(raw_text)
                    elapsed = round(time.time() - start, 2)
                    logger.info(f"Success: model={model}, key_idx={key_idx}, elapsed={elapsed}s")
                    return parsed, {"model": model, "key_index": key_idx, "elapsed_seconds": elapsed}
            except urllib.error.HTTPError as e:
                body = ""
                try: body = e.read().decode()[:120]
                except Exception: pass
                logger.warning(f"HTTP {e.code} on {model}/key{key_idx}: {e.reason} {body}")
                last_error = f"HTTP {e.code}: {e.reason}"
                time.sleep(0.5)
            except Exception as e:
                logger.warning(f"Error on {model}/key{key_idx}: {e}")
                last_error = str(e)
                time.sleep(0.5)

    raise RuntimeError(f"All Gemini models and keys exhausted. Last error: {last_error}")
