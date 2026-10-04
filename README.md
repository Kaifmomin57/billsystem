# 🧾 BillTrack — Intelligent Billing, Ledger & Invoice Management System

A full-stack, enterprise-grade billing, accounting, and invoice management web application with **OCR AI ledger digitization**, **PDF invoice generation**, **automated WhatsApp delivery**, and **multi-sheet Excel reporting**.

---

## 🏗️ High-Level System Architecture & Flow

```mermaid
graph TD
    subgraph Client ["Frontend (React + Vite + Tailwind CSS)"]
        UI[User Interface / Pages]
        Axios[Axios API Client (lib/api.js)]
        Router[React Router SPA]
    end

    subgraph Server ["Backend (FastAPI + Python)"]
        Main[app/main.py]
        Routes[API Routes (app/api/routes/*)]
        Services[Business Services (app/services/*)]
        Security[Auth & Security (app/core/security.py)]
    end

    subgraph Data ["Data & External Integrations"]
        DB[(PostgreSQL / SQLite Database)]
        Gemini[Google Gemini AI (OCR Engine)]
        Cloudinary[Cloudinary Cloud Storage]
        OpenWA[OpenWA WhatsApp Gateway]
    end

    UI --> Router --> Axios
    Axios -- "HTTP / REST (JWT Auth)" --> Main --> Routes
    Routes --> Security
    Routes --> DB
    Routes --> Services
    Services --> Gemini
    Services --> Cloudinary
    Services --> OpenWA
    Services --> DB
```

---

## 📂 Exhaustive File Structure & Component Breakdown

```
billingwebsite/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/
│   │   │       ├── auth.py
│   │   │       ├── bills.py
│   │   │       ├── customers.py
│   │   │       ├── products.py
│   │   │       ├── rates.py
│   │   │       ├── reports.py
│   │   │       ├── settings.py
│   │   │       ├── stats.py
│   │   │       └── uploads.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── database.py
│   │   │   └── security.py
│   │   ├── models/
│   │   │   └── models.py
│   │   ├── schemas/
│   │   │   └── schemas.py
│   │   ├── services/
│   │   │   ├── cloudinary_service.py
│   │   │   ├── excel_service.py
│   │   │   ├── gemini_service.py
│   │   │   ├── pdf_service.py
│   │   │   └── whatsapp_service.py
│   │   ├── utils/
│   │   │   └── image_preprocessor.py
│   │   └── main.py
│   ├── migrations/
│   ├── requirements.txt
│   ├── .env.example
│   └── .env
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AppLayout.jsx
│   │   │   ├── ProtectedRoute.jsx
│   │   │   └── Sidebar.jsx
│   │   ├── lib/
│   │   │   ├── api.js
│   │   │   ├── auth.js
│   │   │   └── utils.js
│   │   ├── pages/
│   │   │   ├── BillsPage.jsx
│   │   │   ├── CustomersPage.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   ├── ProductsPage.jsx
│   │   │   ├── RatesPage.jsx
│   │   │   ├── ReportsPage.jsx
│   │   │   ├── SettingsPage.jsx
│   │   │   └── UploadPage.jsx
│   │   ├── App.css
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vercel.json
│   └── vite.config.js
├── vercel.json
├── Billing Website PRD.md
└── README.md
```

---

## ⚙️ Backend Breakdown (`backend/`)

### 1. Core Engine (`backend/app/core/`)
* **`config.py`**:
  * **What it does:** Uses `pydantic_settings.BaseSettings` to load and validate environment variables (database connection string, JWT secrets, Gemini API keys rotation list, Cloudinary keys, OpenWA config).
  * **Where it connects:** Imported across all services, database connection handlers, and security middleware.
* **`database.py`**:
  * **What it does:** Initializes the SQLAlchemy database engine (`create_engine`), session factory (`sessionmaker`), and the base declarative model (`Base`). Provides the `get_db` FastAPI dependency for database session injection.
  * **Where it connects:** Used in `main.py` and injected into every API route in `app/api/routes/`.
* **`security.py`**:
  * **What it does:** Implements password hashing with `passlib.context.CryptContext` (bcrypt), JWT token creation (`create_access_token`), and token verification. Provides the `get_current_user` FastAPI dependency for route authentication.
  * **Where it connects:** Injected into `auth.py` for logging in, and all protected endpoints to ensure authorized access.

---

### 2. Database Models (`backend/app/models/`)
* **`models.py`**:
  * **What it does:** Defines the SQLAlchemy ORM schema for the entire application:
    * **`User`**: System users & credentials for authentication.
    * **`Customer`**: Customer directory (name, alias, phone, address, GSTIN, opening balance).
    * **`Product`**: Product master catalogue (name, short code, unit, default base price).
    * **`Rate`**: Custom rate overrides mapped per customer & per product.
    * **`Bill`**: Invoice metadata (bill number, date, subtotal, carry forward balance, discount, net amount, amount paid, balance due, payment status, payment method).
    * **`BillItem`**: Line items for each bill (product, quantity, applied rate, line amount, tag/notes).
    * **`Payment`**: Payment transaction history (cash, UPI, bank transfer, date, reference notes).
    * **`Upload`**: Physical ledger image capture records, raw OCR JSON draft data, and processing status.
    * **`Tag`**: OCR shorthand tags dictionary (e.g. `JB` = Jumbo, `T` = Return).
  * **Where it connects:** Queried and updated by all API routes in `app/api/routes/` and read by reporting services.

---

### 3. API Route Controllers (`backend/app/api/routes/`)
* **`auth.py`**:
  * **What it does:** Handles `/auth/login` (verifies credentials, generates JWT access token) and `/auth/register`.
  * **Where it connects:** Connects `models.User`, `core/security.py`, and the frontend `LoginPage.jsx`.
* **`bills.py`**:
  * **What it does:** Comprehensive invoice management:
    * Creating new bills with line items and automatic balance calculation.
    * Carry forward balance tracking per customer.
    * Recording payments (Cash / UPI) and recalculating dues.
    * Editing existing bills and recalculating totals.
    * Deleting bills (with automatic cascade cleanup).
    * Generating & streaming downloadable ReportLab PDF invoices (`/bills/{id}/pdf`).
    * Direct WhatsApp delivery of PDF invoices via OpenWA (`/bills/{id}/send-whatsapp`).
  * **Where it connects:** Connects `models.Bill`, `models.Payment`, `pdf_service.py`, `whatsapp_service.py`, `cloudinary_service.py`, and frontend `BillsPage.jsx`.
* **`customers.py`**:
  * **What it does:** CRUD operations for customers. Handles cascade deletion of customer history and custom rates.
  * **Where it connects:** Connects `models.Customer`, `models.Bill`, and frontend `CustomersPage.jsx`.
* **`products.py`**:
  * **What it does:** CRUD operations for product catalog (product codes, names, default rates).
  * **Where it connects:** Connects `models.Product`, `models.Rate`, and frontend `ProductsPage.jsx`.
* **`rates.py`**:
  * **What it does:** Manages customer-specific pricing matrices (Rate Matrix). Supports bulk rate updates per product or customer.
  * **Where it connects:** Connects `models.Rate`, `models.Customer`, `models.Product`, and frontend `RatesPage.jsx`.
* **`reports.py`**:
  * **What it does:** Generates financial summary aggregations and exports Excel spreadsheets:
    * `/reports/daily/by-customer`: Daily sales, received payments, and pending dues grouped by customer.
    * `/reports/daily/by-product`: Quantity sold and revenue grouped by product.
    * Excel streaming using `excel_service.py`.
  * **Where it connects:** Connects `excel_service.py` and frontend `ReportsPage.jsx`.
* **`settings.py`**:
  * **What it does:** Manages ledger shorthand tags (e.g. OCR tag definitions) and business profile settings.
  * **Where it connects:** Connects `models.Tag` and frontend `SettingsPage.jsx` / `UploadPage.jsx`.
* **`stats.py`**:
  * **What it does:** Computes live financial metrics for the dashboard (today's sales, cash vs UPI inflow, unpaid accounts, top outstanding debtors, recent bill stream).
  * **Where it connects:** Connects `models.Bill`, `models.Payment`, and frontend `Dashboard.jsx`.
* **`uploads.py`**:
  * **What it does:** Handles ledger photo upload, pre-processing, Gemini OCR extraction, draft review data persistence, 3-sheet Excel page export, and confirmation of drafts into customer bills.
  * **Where it connects:** Connects `gemini_service.py`, `image_preprocessor.py`, `excel_service.py`, and frontend `UploadPage.jsx`.

---

### 4. Business Logic & Integrations (`backend/app/services/`)
* **`excel_service.py`**:
  * **What it does:** Builds formatted `.xlsx` spreadsheets with `openpyxl`:
    * Multi-sheet Digitized Ledger Excel (Sheet 1: Ledger Matrix, Sheet 2: Flat Entries List, Sheet 3: Needs Review).
    * Daily Sales & Customer Summary reports with KPI summary cards.
    * Daily Product breakdown reports with grand totals.
  * **Where it connects:** Invoked by `routes/reports.py` and `routes/uploads.py`.
* **`gemini_service.py`**:
  * **What it does:** Connects to Google Gemini API (`gemini-1.5-flash` / `gemini-1.5-pro`) with automated multi-key rotation to parse handwritten/printed ledger photos into structured JSON grid data.
  * **Where it connects:** Invoked by `routes/uploads.py`.
* **`pdf_service.py`**:
  * **What it does:** Generates PDF invoices using ReportLab with company branding, itemized tables, GSTIN, payment breakdown, and QR code placeholders.
  * **Where it connects:** Invoked by `routes/bills.py`.
* **`whatsapp_service.py`**:
  * **What it does:** Integrates with OpenWA gateway to send customer bill notifications and PDF invoice download links over WhatsApp.
  * **Where it connects:** Invoked by `routes/bills.py`.
* **`cloudinary_service.py`**:
  * **What it does:** Uploads generated PDF invoices or bill photos to Cloudinary cloud storage to produce publicly shareable HTTPS links for WhatsApp.
  * **Where it connects:** Invoked by `routes/bills.py` and `whatsapp_service.py`.

---

### 5. Utilities (`backend/app/utils/`)
* **`image_preprocessor.py`**:
  * **What it does:** Uses PIL (Python Imaging Library) to resize, enhance contrast, and prepare uploaded bill photos before sending them to Gemini AI for maximum OCR extraction accuracy.
  * **Where it connects:** Invoked by `routes/uploads.py`.

---

### 6. App Root (`backend/app/main.py`)
* **`main.py`**:
  * **What it does:** Instantiates the FastAPI application, configures CORS middleware (allowing frontend communication), registers all API routers, creates database tables on startup, and sets up static file mounts.

---

## 🎨 Frontend Breakdown (`frontend/`)

### 1. State, Auth & API Client (`frontend/src/lib/`)
* **`api.js`**:
  * **What it does:** Configures the centralized `axios` instance with `API_BASE_URL` (reads `VITE_API_URL`), attaches the JWT Bearer token on outgoing requests, and handles 401 unauthorized responses.
  * **Where it connects:** Imported by every page and React Query hook across the entire frontend.
* **`auth.js`**:
  * **What it does:** Manages JWT storage (`localStorage.getItem("access_token")`, `setToken`, `clearToken`, `isAuthenticated`).
  * **Where it connects:** Used by `ProtectedRoute.jsx`, `LoginPage.jsx`, and `Sidebar.jsx`.
* **`utils.js`**:
  * **What it does:** Helper functions for currency formatting (`formatCurrency` - ₹ Indian Rupee formatting), date formatting (`formatDate`), text truncation, and client-side file downloads (`downloadBlob`).
  * **Where it connects:** Used across all pages for consistent number and date representations.

---

### 2. Layout & Guards (`frontend/src/components/`)
* **`AppLayout.jsx`**:
  * **What it does:** Responsive application shell containing the sidebar and the main `<Outlet />` area.
  * **Where it connects:** Wraps all authenticated pages in `App.jsx`.
* **`ProtectedRoute.jsx`**:
  * **What it does:** Authentication barrier that checks `authStorage.isAuthenticated()`. Redirects unauthenticated traffic to `/login`.
  * **Where it connects:** Enforces access control on all private routes in `App.jsx`.
* **`Sidebar.jsx`**:
  * **What it does:** Navigation sidebar for desktop and mobile slide-out drawer with active link highlighting and sign-out button.
  * **Where it connects:** Rendered inside `AppLayout.jsx`.

---

### 3. Application Views (`frontend/src/pages/`)
* **`LoginPage.jsx`**:
  * **What it does:** Admin login form with username/password inputs, password visibility toggle, error toast notifications, and JWT token storage.
* **`Dashboard.jsx`**:
  * **What it does:** Financial dashboard displaying real-time total sales, cash/UPI inflow cards, pending customer dues table, quick ledger upload shortcuts, and recent bill activity stream.
  * **Connects to:** `backend/app/api/routes/stats.py`.
* **`CustomersPage.jsx`**:
  * **What it does:** Customer registry management: search, add customer modal, edit details, view outstanding balances, and delete customers.
  * **Connects to:** `backend/app/api/routes/customers.py`.
* **`ProductsPage.jsx`**:
  * **What it does:** Product catalogue management: product codes, product names, default prices, and CRUD operations.
  * **Connects to:** `backend/app/api/routes/products.py`.
* **`RatesPage.jsx`**:
  * **What it does:** Interactive pricing grid where custom product rates can be set for individual customers.
  * **Connects to:** `backend/app/api/routes/rates.py`.
* **`BillsPage.jsx`**:
  * **What it does:** Core billing workspace:
    * Create new invoices with dynamic line items and auto-calculated rates.
    * Previous customer balance carry-forward calculation.
    * Edit existing bills.
    * Collect full or partial payments (Cash / UPI).
    * Single-click PDF invoice generation and download.
    * Single-click WhatsApp invoice delivery.
  * **Connects to:** `backend/app/api/routes/bills.py`.
* **`UploadPage.jsx`**:
  * **What it does:** AI ledger digitization screen:
    * Upload/capture bill image.
    * AI extraction with Google Gemini.
    * Side-by-side interactive grid review with zoom controls.
    * Direct cell editing, low-confidence cell highlights, and tag explanations.
    * 3-sheet Excel spreadsheet export.
    * Confirmation button to automatically generate customer bills from the digitized ledger.
  * **Connects to:** `backend/app/api/routes/uploads.py`.
* **`ReportsPage.jsx`**:
  * **What it does:** Financial reporting hub:
    * Filter reports by date range, customer, and product.
    * Daily sales vs collected cash vs outstanding dues summary cards.
    * Download formatted customer and product Excel reports.
  * **Connects to:** `backend/app/api/routes/reports.py`.
* **`SettingsPage.jsx`**:
  * **What it does:** Shorthand OCR tags configuration and application preferences.
  * **Connects to:** `backend/app/api/routes/settings.py`.

---

## 🔗 End-to-End Interconnection Map

| Frontend Page / Component | Action Triggered | Backend API Endpoint | Backend Service Invoked | Database Models Affected |
|---|---|---|---|---|
| `LoginPage.jsx` | User signs in | `POST /auth/login` | `core/security.py` | `User` |
| `Dashboard.jsx` | Page load / polling | `GET /stats/dashboard` | Aggregation queries | `Bill`, `Payment`, `Customer` |
| `CustomersPage.jsx` | Add / Edit / Delete Customer | `POST`, `PUT`, `DELETE /customers` | Cascade handlers | `Customer`, `Bill`, `Rate` |
| `ProductsPage.jsx` | Add / Edit / Delete Product | `POST`, `PUT`, `DELETE /products` | Cascade handlers | `Product`, `Rate` |
| `RatesPage.jsx` | Update customer price matrix | `POST /rates/bulk` | Bulk upsert | `Rate` |
| `BillsPage.jsx` | Create / Edit Bill | `POST`, `PUT /bills` | Ledger math | `Bill`, `BillItem`, `Payment` |
| `BillsPage.jsx` | Record Payment | `POST /bills/{id}/payments` | Payment handler | `Payment`, `Bill` |
| `BillsPage.jsx` | Download PDF | `GET /bills/{id}/pdf` | `pdf_service.py` | `Bill`, `Customer` |
| `BillsPage.jsx` | Send WhatsApp | `POST /bills/{id}/send-whatsapp` | `whatsapp_service.py`, `cloudinary_service.py` | `Bill`, `Customer` |
| `UploadPage.jsx` | Upload Ledger Photo | `POST /uploads` | `gemini_service.py`, `image_preprocessor.py` | `Upload` |
| `UploadPage.jsx` | Export 3-Sheet Excel | `GET /uploads/{id}/excel` | `excel_service.py` | `Upload` |
| `UploadPage.jsx` | Confirm Draft to Bills | `POST /uploads/{id}/confirm` | Bill factory | `Upload`, `Bill`, `BillItem` |
| `ReportsPage.jsx` | Export Excel Reports | `GET /reports/daily/*` | `excel_service.py` | `Bill`, `BillItem`, `Customer` |

---

## 🚀 Setup & Local Execution

### 1. Backend Setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate      # Windows (PowerShell: .\venv\Scripts\Activate.ps1)
# source venv/bin/activate # Linux / macOS

pip install -r requirements.txt
cp .env.example .env
# Fill in your DATABASE_URL, GEMINI_API_KEYS, and SECRET_KEY in .env

# Run FastAPI Server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Backend API interactive docs: `http://localhost:8000/docs`

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Frontend App will run at: `http://localhost:5173`

---

## 🌐 Production Deployment Guide

### Vercel (Frontend)
1. Import repository on Vercel.
2. Set **Root Directory** to `frontend`.
3. Set Environment Variable:
   - `VITE_API_URL`: `https://your-backend-domain.com`
4. The included `vercel.json` ensures all SPA routes (`/bills`, `/reports`, `/customers`, etc.) work seamlessly without 404s.

### Render / Railway / VPS (Backend)
1. Deploy `backend` folder as a Python web service.
2. Build Command: `pip install -r requirements.txt`
3. Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Configure all environment variables from `backend/.env.example`.
