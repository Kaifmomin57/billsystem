# Product Requirements Document: Billing Website

**Version:** 1.1 (Draft) - updated after reviewing a sample handwritten ledger page **Date:** 2 October 2026 **Tech stack:** Python (FastAPI) · React · Tailwind CSS v3 · PostgreSQL · Google Gemini API

---

## 1. Overview

A web-based billing tool that lets a business owner set up rates once (per customer and per product), keep bills organised by customer, download daily Excel reports, and automatically capture bill data by uploading a photo of the bill, which is read by Gemini AI.

### 1.1 Problem

- Rates differ by customer and by product, and are re-typed or looked up manually.
- Paper or photo bills have to be typed into reports by hand, which is slow and error-prone.
- Daily totals by product and by customer are compiled manually.

### 1.2 Goals

1. Set rates once, edit them when they change.
2. Download daily Excel reports by product and by customer in one click.
3. Upload a photo of a handwritten ledger page (or a single bill), have Gemini read it into a structured grid, convert it to Excel, and add each row to the correct customer's records after review.

### 1.3 Non-Goals (v1)

- Online payments or payment gateway integration.
- GST/tax filing or e-invoicing integration.
- Multi-company / multi-tenant support.
- Mobile native app (the web app must be mobile-responsive).

### 1.4 Users

| Role | Description |
| --- | --- |
| **Admin / Owner** | Manages rates, customers, products, uploads bills, downloads reports. |

> v1 assumes a single login role. Staff roles can be added later.

---

## 2. Key Concepts and Assumptions

- **Product base rate:** the default rate of a product, set one time and editable.
- **Customer rate:** a special rate for a specific customer and product, set one time and editable.
- **Rate resolution order:** Customer rate (if exists) → otherwise Product base rate.
- Editing a rate affects **future bills only**. Past bills keep the rate they were created with (rate is stored on each bill line).
- Every rate change is stored in a history table for audit.

---

## 3. Features

### F1. Customer and Product Master

**Description:** Basic data needed for rates and bills.

| ID | Requirement | Priority |
| --- | --- | --- |
| F1.1 | Add, edit, deactivate customers (name, phone, address, notes). | Must |
| F1.2 | Add, edit, deactivate products (name, unit such as kg/pcs/litre). | Must |
| F1.3 | Search and filter customers and products. | Should |

### F2. Rate Management

**Description:** Set rates once, edit when they change.

| ID | Requirement | Priority |
| --- | --- | --- |
| F2.1 | **Rate by product (base rate):** user selects a product and enters a rate. Saved as the default. | Must |
| F2.2 | **Rate by customer name:** user selects a customer, then a product, and enters a special rate for that pair. | Must |
| F2.3 | **Edit rate:** any base rate or customer rate can be edited at any time from a rate table. | Must |
| F2.4 | Only one active rate per (customer, product) pair and per product base. Re-adding shows "rate already exists, edit instead?". | Must |
| F2.5 | Rate history: store old rate, new rate, who changed it, and when. Viewable per rate. | Should |
| F2.6 | Rate table view: grid of customers × products showing effective rate, with an indicator for "custom" vs "base". | Should |
| F2.7 | Bulk import of rates via Excel/CSV. | Could |

**Acceptance criteria**

- When a customer-specific rate exists, bills for that customer use it; otherwise the base rate is used.
- Editing a rate does not change the amounts on previously saved bills.

### F3. Daily Excel Reports

**Description:** Download the day's data as Excel.

| ID | Requirement | Priority |
| --- | --- | --- |
| F3.1 | **Daily report by product:** date picker → download `.xlsx` with product, total quantity, rate, total amount. | Must |
| F3.2 | **Daily report by customer:** date picker → download `.xlsx` with customer, product lines, quantity, rate, amount, customer total. | Must |
| F3.3 | Date range option (from–to) in addition to a single day. | Should |
| F3.4 | Filter by a single customer or product before download. | Should |
| F3.5 | Grand total row at the bottom of each report. | Must |
| F3.6 | File name format: `daily_by_product_YYYY-MM-DD.xlsx`, `daily_by_customer_YYYY-MM-DD.xlsx`. | Must |

**Acceptance criteria**

- Totals in the Excel file match totals shown on screen for the same date.
- Report downloads in under 5 seconds for up to 5,000 bill lines.

### F4. Ledger / Bill Image Upload → Excel → Customer Records

**Description:** The owner photographs a handwritten ledger page (like the sample in Appendix A) or a single bill and uploads it. The backend sends the image to Gemini using the owner's API key. Gemini reads the grid and returns structured rows. The system shows a review screen, produces an Excel version of the page, and, after the user confirms, adds each row to the matching customer's records and reports.

**Flow:** Upload → Pre-process image → Gemini extraction → Review grid (image beside data) → Confirm → (a) entries saved to customers, (b) Excel of the page generated.

| ID | Requirement | Priority |
| --- | --- | --- |
| F4.1 | Upload JPG/PNG/WEBP (WhatsApp photos supported), max 10 MB, with camera capture on mobile. | Must |
| F4.2 | **Image pre-processing** before sending to Gemini: auto-rotate, crop to page, increase contrast/sharpness, resize. Photos are often angled and shadowed. | Should |
| F4.3 | Upload type selector: **Ledger page** (grid of many customers) or **Single bill**. | Must |
| F4.4 | Gemini returns strict JSON: page date, column headers, and for every row the customer name (as written) plus each cell with `column`, `quantity`, `rate`, `tag`, `circled_value`, `struck_out`, `raw_text`, `confidence`. | Must |
| F4.5 | **Column code mapping:** headers such as M, R, B, P, K, T, JB are shorthand. Owner maps each code to a product once in a settings screen (stored as a template and reused on every upload). | Must |
| F4.6 | **Fraction notation:** cells written as a number over a number (for example 39 over 50) are parsed as quantity and rate by default (to be confirmed, see Open Questions). Parsed rate is compared with the saved rate and mismatches are highlighted. | Must |
| F4.7 | **Suffix tags** written beside values (for example pd, mi, N, B, R, k) are captured as tags. A configurable tag dictionary gives each tag a meaning. Unknown tags are shown for the user to define. | Should |
| F4.8 | **Circled numbers** are captured separately as `circled_value`. The owner defines what they mean (for example total, amount received, bags/count). | Must |
| F4.9 | **Struck-out / overwritten values** are detected. Struck-out values are ignored by default, and the corrected value is used. The user can see both. | Must |
| F4.10 | **Multiple rows for one customer** on the same page (for example the same name written twice) can be merged into one bill or kept as separate lines, at the user's choice. | Should |
| F4.11 | **Customer name matching** for Devanagari (Hindi) and Roman (English) handwriting. Fuzzy match against customers and an **alias table** (for example the Hindi and English spellings of the same name). Unmatched names: pick existing customer, create new, or skip. | Must |
| F4.12 | **Confidence scoring:** low-confidence cells are highlighted yellow, unreadable cells red. Red cells must be fixed or marked "skip" before confirming. | Must |
| F4.13 | **Review screen:** the original image on one side (zoom/pan, row highlight on click) and an editable grid on the other. The page date is always editable and must be confirmed because handwritten dates are easy to misread. | Must |
| F4.14 | **Excel conversion:** generate an `.xlsx` of the digitised page: Sheet 1 "Ledger" (customer rows × product columns, same layout as the paper), Sheet 2 "Entries" (flat list: date, customer, product, quantity, rate, amount, tag, circled value, confidence, status), Sheet 3 "Needs review". Downloadable from the review screen and after saving. | Must |
| F4.15 | **Add to customers:** on confirm, create one bill per customer for the page date with line items. These appear in the customer report and in the daily Excel reports (F3). | Must |
| F4.16 | Store the original image and link it to every bill created from it. | Must |
| F4.17 | **Duplicate protection:** warn if the same image (hash) or the same page date and customer entries already exist. | Should |
| F4.18 | **Learning from corrections:** when the user fixes a name, tag or column, offer to save it as an alias or mapping so future uploads are more accurate. | Should |
| F4.19 | Status per upload: Uploaded → Processing → Needs review → Saved / Failed, with retry and a manual-entry fallback. | Should |
| F4.20 | Batch upload of multiple pages at once. | Could |

**Acceptance criteria**

- Nothing is added to any customer until the user confirms on the review screen.
- Every extracted value can be traced back to the image (row highlight) and to its `raw_text`.
- Excel output has one row per customer per product, and its totals match the saved customer totals.
- Gemini errors or invalid JSON show a clear message and allow manual entry.
- The Gemini API key is never exposed to the browser.

### F5. Customer Reports

| ID | Requirement | Priority |
| --- | --- | --- |
| F5.1 | Customer page lists all bills (date, bill no, total, image link). | Must |
| F5.2 | Filter by date range; show running total. | Should |
| F5.3 | Download a single customer's statement as Excel. | Should |

### F6. Manual Bill Entry (fallback)

| ID | Requirement | Priority |
| --- | --- | --- |
| F6.1 | Create a bill manually: pick customer, add products, quantity; the rate auto-fills from rate resolution. | Must |
| F6.2 | Edit or delete a saved bill (with confirmation). | Should |

### F7. Authentication

| ID | Requirement | Priority |
| --- | --- | --- |
| F7.1 | Login with username and password (JWT). | Must |
| F7.2 | All APIs require authentication. | Must |

---

## 4. User Flows

**Set rates** `Rates → Product Rates → pick product → enter rate → Save` · `Rates → Customer Rates → pick customer → pick product → enter rate → Save` · Edit any row inline.

**Upload bill** `Upload Ledger Page → choose/capture photo → Processing → Review grid beside image (fix highlighted cells, confirm date) → Confirm → Entries added to each customer + Excel of the page available to download`

**Set up ledger reading (one time)** `Settings → map column codes (M, R, B, P, K, T, JB) to products → add customer aliases → define tag and circled-number meanings`

**Download daily report** `Reports → choose "By Product" or "By Customer" → pick date → Download Excel`

---

## 5. Data Model (PostgreSQL)

| Table | Key columns |
| --- | --- |
| `users` | id, username, password_hash, created_at |
| `customers` | id, name (unique), phone, address, is_active, created_at |
| `products` | id, name (unique), unit, is_active, created_at |
| `product_rates` | id, product_id (unique), rate, updated_at |
| `customer_rates` | id, customer_id, product_id, rate, updated_at, **unique (customer_id, product_id)** |
| `rate_history` | id, rate_type, customer_id (nullable), product_id, old_rate, new_rate, changed_by, changed_at |
| `bills` | id, customer_id, bill_no, bill_date, total_amount, source (`manual`/`ledger_ai`/`bill_ai`), upload_id (nullable), image_path, status, created_at |
| `bill_items` | id, bill_id, product_id, quantity, rate, amount, tag, circled_value, confidence, raw_text, source_upload_id |
| `uploads` | id, upload_type (`ledger`/`bill`), image_path, image_hash, page_date, status, gemini_raw_response (JSONB), draft_data (JSONB), excel_path, error_message, created_at |
| `column_mappings` | id, column_code (M, R, B, P, K, T, JB), product_id, active |
| `customer_aliases` | id, customer_id, alias (Hindi or English spelling) |
| `tag_dictionary` | id, tag (pd, mi, N, B, R, k...), meaning |

Indexes: `bills(bill_date)`, `bills(customer_id, bill_date)`, `bill_items(product_id)`.

---

## 6. API Outline (FastAPI)

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/auth/login` | Login, returns JWT |
| GET/POST/PUT | `/customers`, `/products` | Master CRUD |
| GET/POST/PUT | `/rates/products` | Base rates |
| GET/POST/PUT | `/rates/customers` | Customer rates |
| GET | `/rates/effective?customer_id=&product_id=` | Resolved rate |
| POST | `/uploads` | Upload ledger/bill image, trigger Gemini extraction |
| GET | `/uploads/{id}` | Poll status and get draft grid |
| PUT | `/uploads/{id}/draft` | Save user corrections to the draft |
| POST | `/uploads/{id}/confirm` | Create bills and add entries to customers |
| GET | `/uploads/{id}/excel` | Download the digitised page as Excel |
| GET/POST/PUT | `/column-mappings`, `/customer-aliases`, `/tag-dictionary` | Settings used by extraction |
| POST | `/bills` | Create a bill manually |
| GET/PUT/DELETE | `/bills/{id}` | View, edit, delete bill |
| GET | `/customers/{id}/bills` | Customer report |
| GET | `/reports/daily/by-product?date=` | Download Excel |
| GET | `/reports/daily/by-customer?date=` | Download Excel |

---

## 7. Technical Architecture

| Layer | Choice | Notes |
| --- | --- | --- |
| Frontend | React (Vite) + Tailwind CSS v3 | Mobile-first responsive UI. React Router, TanStack Query, React Hook Form. |
| Backend | Python, FastAPI | SQLAlchemy + Alembic migrations, Pydantic validation. |
| Database | PostgreSQL | Use `NUMERIC(12,2)` for all money values. |
| AI | Google Gemini API (vision) | Key stored in backend environment variable `GEMINI_API_KEY`. Request JSON output with a defined schema. |
| Excel | `openpyxl` or `XlsxWriter` | Generated server-side and streamed as download. |
| File storage | Local disk (v1) or S3-compatible bucket | Store image path in DB. |
| Deployment | Docker Compose (api, web, db) | Reverse proxy with HTTPS. |

**Gemini extraction approach**

1. Frontend uploads the image to the backend.
2. Backend validates type and size, pre-processes the image (rotate, crop, enhance), and saves it.
3. Backend calls Gemini (vision) with a prompt that includes the known column codes, customer names and aliases, and the tag dictionary, and asks for strict JSON in a defined schema, including per-cell confidence and a `raw_text` copy of what is written.
4. Backend validates the JSON with Pydantic, applies column mapping, fraction parsing, name matching and rate comparison, and stores a draft.
5. User reviews and corrects on the review screen.
6. On confirm, the backend saves bills and line items, then builds the Excel file with `openpyxl`.

---

## 8. Non-Functional Requirements

- **Security:** hashed passwords (bcrypt/argon2), JWT auth, HTTPS, API key only on server, file type validation, rate limiting on upload endpoint.
- **Performance:** pages load under 2 seconds; AI extraction typically returns within 10 to 15 seconds, with a loading state.
- **Accuracy:** AI-extracted data is always user-reviewed before saving.
- **Reliability:** daily database backups; money stored as NUMERIC, never float.
- **Usability:** works well on phone browsers since bills will often be photographed on mobile.
- **Auditability:** rate changes logged; bills keep original image.

---

## 9. Success Metrics

- Time to add a bill via image under 1 minute (vs manual entry).
- At least 90% of AI-extracted fields need no correction after a few weeks of use.
- Daily report generated in 2 clicks.
- Zero mismatches between report totals and bill totals.

---

## 10. Milestones (suggested)

| Phase | Scope | Estimate |
| --- | --- | --- |
| 1 | Project setup, auth, customer/product master, DB schema | 1 week |
| 2 | Rate management (base + customer, edit, history) | 1 week |
| 3 | Manual bill entry + customer reports | 1 week |
| 4 | Daily Excel reports (by product, by customer) | 3 to 4 days |
| 5 | Ledger/bill upload, Gemini extraction, column/alias/tag settings, review screen, Excel conversion | 3 weeks |
| 6 | Testing, polish, deployment | 1 week |

---

## 11. Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Handwritten ledger is hard to read (mixed Hindi/English, shorthand, overwriting, cramped rows) | Mandatory review screen, per-cell confidence, row-to-image highlighting, image pre-processing, and prompts that include known names and codes. |
| Meaning of fractions, suffix letters and circled numbers is ambiguous | Owner defines these once in settings; unknown items are flagged instead of guessed. |
| Misread page date | Date is always shown for confirmation before saving. |
| Name mismatch between bill and master data | Fuzzy matching plus "pick or create" prompt. |
| Gemini API cost or quota limits | Resize/compress images before sending; cache results; show quota errors clearly. |
| Rate changes confusing past totals | Store rate on each bill line; changes affect future bills only. |
| API key leakage | Keep key server-side only, never in React code or Git. |

---

## 12. Open Questions

1. Bills and ledger pages are handwritten in mixed Hindi and English. Is that always the case?
2. Should taxes (GST) or discounts appear on bills and reports?
3. Is one login enough, or will staff need separate accounts with limited access?
4. Should the daily report include only AI-uploaded bills or also manual ones? (Assumed: both.)
5. Do you want Excel reports in a specific column layout or template?
6. Where will this be hosted (own server, cloud VPS)?
7. **Column codes:** what do M, R, B, P, K, T and JB stand for (which product each one is)? Are they the same on every page?
8. **Fractions:** in entries such as 39 over 50, is the top number the quantity and the bottom number the rate per unit?
9. **Circled numbers:** do they mean total amount, payment received, or something else?
10. **Suffix letters** (pd, mi, N, B, R, k): what does each one mean?
11. Is each ledger page always one day, with the date written at the top?
12. Should payments or balances be tracked per customer, or only quantities and amounts?

---

## 13. Out of Scope for Future Versions

- Payment tracking and outstanding balance per customer.
- WhatsApp/email sending of bills.
- PDF invoice generation.
- Multiple branches or companies.
- Role-based access for staff.

---

## Appendix A: Analysis of the Sample Ledger Page

The sample photo shows a ruled notebook page with a handwritten date and weekday (Hindi) at the top. These observations drive the F4 requirements. Handwriting is hard to read in places, so items marked "appears" must be confirmed with the owner.

| Observation | What it means for the product |
| --- | --- |
| A grid with a **NAME** column and seven narrow columns headed **M, R, B, P, K, T, JB**. | Headers are shorthand codes, not product names. A one-time column-to-product mapping is needed (F4.5). |
| About 15 customer rows, with names written in **both Devanagari and Roman letters** (for example a name appearing as both "Ramvir" and in Hindi). | Name matching needs aliases and fuzzy matching across scripts (F4.11). |
| The same customer **appears more than once** on a page, and some rows have a second line of numbers below the first. | Merge or split option for repeated customers and sub-rows (F4.10). |
| Cell values are mostly decimals (for example 6.5, 8.4, 20.1, 15.4), so quantities carry decimals. | Quantity fields must support decimals. |
| Several cells are written as **one number over another** (for example a value over 50, 100, 125, 135 or 145). | Likely quantity over rate. Parsed and compared with saved rates (F4.6). |
| Numbers carry **letter suffixes** (for example pd, mi, N, B, R, k). | Captured as tags with a configurable meaning (F4.7). |
| Many cells in the last columns have **circled numbers** (for example 6, 10, 35, 100, 30, 20, 15). | Captured separately; meaning defined by the owner (F4.8). |
| Some values are **crossed out or written over**. | Struck-out detection and corrected value handling (F4.9). |
| Some **margin notes** sit to the left of the grid, outside the table. | Ignored by default and kept as "notes" on the draft. |
| The last row (appears to be "VAISHALI") has a small set of values underlined. | Rows may be totals or special entries; flagged for review. |
| The photo is **slightly angled, with shadows and a keyboard visible** at the top. | Image pre-processing and cropping are needed (F4.2). |

**Recommended rollout for ledger reading:** start with the owner mapping the column codes and tag meanings, run 5 to 10 real pages in review mode, save every correction as an alias or mapping, and track the percentage of cells needing correction before relying on it day to day.