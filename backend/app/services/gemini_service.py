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

LEDGER_PROMPT = """You are an expert document AI parsing Indian business ledgers and handwritten sales slips (e.g. fish, poultry, mandi trade).
Analyze the image with extreme precision and return ONLY valid JSON matching this schema:

{
  "page_date": "YYYY-MM-DD or raw date string from page or null",
  "column_codes": ["..."],
  "rows": [
    {
      "customer_name_raw": "Patil",
      "cells": {
        "COLUMN_CODE": {
          "quantity": 5.5,
          "rate": null,
          "tag": null,
          "circled_value": null,
          "is_live": false,
          "struck_out": false,
          "raw_text": "5.5 T",
          "confidence": 0.95
        }
      }
    }
  ]
}

CRITICAL RULES:
0. ORIENTATION & ROTATION (CRITICAL):
   The photo might be taken sideways (rotated 90° or 270°) or in landscape/skewed orientation. First detect the primary text reading direction from customer names and numbers, and extract all rows and columns along the true text lines regardless of image rotation.

1. HORIZONTAL LINE ALIGNMENT (CRITICAL):
   - In lined/ruled notebooks, each customer occupies EXACTLY ONE horizontal line row:
     * Line 1: Customer name on left (e.g. "Vada 2") -> ALL entries on that same horizontal line from left to right belong strictly to Vada 2 (e.g. 5.5 T, 6 R, 7 sil, 9 Pd, 8 PP).
     * Line 2: Customer name on left (e.g. "BABA") -> ALL entries on that same horizontal line from left to right belong strictly to BABA (e.g. 7.8 R, 9.2 sil, 6.7 PP, 8.9 T, 8.3 R).
     * Line 3: Customer name on left (e.g. "Vada 4") -> ALL entries on that same horizontal line from left to right belong strictly to Vada 4 (e.g. 6.5 R, 9.25, 6.7 PP, 8.2 T, 9.7 T).
   - NEVER move entries from one horizontal line to another!

2. DETERMINE DOCUMENT FORMAT:
   A) FIXED COLUMN-HEADER LEDGER:
      - If the page has a top header row with column codes (e.g. M, R, B, P, K, T, JB, etc.):
      - Extract those exact codes into `column_codes`.
      - Place each cell under its corresponding column code header.
      - For fraction notation (e.g. 39 over 50), set quantity=39, rate=50.
      - Capture suffix letters (pd, mi, N, B, R, k, K, T, JB) as tag.

   B) INLINE PRODUCT / SLIP FORMAT (No top header row):
      - If product codes or names are written directly beside/next to each quantity number (e.g. "5.5 T", "6 R", "7 sil", "9 Pd", "8 PP", "7.8 R", "9.2 sil", "6.7 PP", "8.9 T", "8.3 R", "6.5 R", "9.25", "8.2 T", "9.7 T"):
      - DO NOT force dummy headers like [M, R, B, P, K]. Instead, identify ALL distinct product codes/names written across all rows (e.g. ["T", "R", "SIL", "PD", "PP"]).
      - Normalize column_codes to uppercase (e.g. "T", "R", "SIL", "PD", "PP").
      - Place each quantity under its actual product code key in `cells`.
      - If a customer row has multiple entries for the same product code (e.g. BABA has "7.8 R" and "8.3 R", or Vada 4 has "8.2 T" and "9.7 T"):
        * Sum the quantities into `quantity` (e.g. 7.8 + 8.3 = 16.1 for R; 8.2 + 9.7 = 17.9 for T).
        * Set `raw_text` to show both entries (e.g. "7.8R + 8.3R").
      - If an entry has no product code written (e.g. "9.25" under column 2 where previous rows had "7 sil" and "9.2 sil"), infer the product code from column alignment (here "SIL").

3. CUSTOMER NAMES:
   Extract customer names from the left column of each row (e.g. "Patil", "Irfan", "Vada 2", "BABA", "Vada 4", "Ramvir", "Vikas", etc.). Never leave customer_name_raw empty.

4. CIRCLED NUMBERS = LIVE FISH (CRITICAL):
   In Indian fish trading ledgers, any number written inside a handwritten drawn circle, oval, ring, or parentheses (e.g. ⊚40, (40), circled 7 in red ink, circled 80, circled 60, circled 100) indicates LIVE FISH (जिंदा / जीवंत मछली).
   - The circled number IS THE QUANTITY! Set `quantity` to that numeric value (e.g. 40.0, 7.0, 80.0, 60.0, 100.0).
   - Set `is_live`: true.
   - Set `circled_value`: string of that number (e.g. "40").
   - Set `raw_text`: e.g. "(40)" or "circled 40".
   - If a cell has both a normal number and a circled number (e.g. "15 (100)"), the circled number is live fish: set `quantity`: 100.0, `is_live`: true, `circled_value`: "100".

5. Crossed-out / struck-out values → struck_out: true, use the corrected value.
6. Confidence: 0.0-1.0 per cell (below 0.7 = yellow flag, below 0.4 = red flag).
7. If date not readable, set page_date to null.
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
