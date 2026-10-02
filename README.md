# 📄 BillSystem — Billing & Invoice Management

A full-stack billing and invoice management system built with **FastAPI** (backend) and **React + Vite** (frontend), using **PostgreSQL** as the database. Supports PDF invoice generation, WhatsApp delivery via OpenWA, and Cloudinary cloud storage.

---

## 🚀 Features

- 👥 Customer management (GSTIN, address, contact info)
- 📦 Product catalog with category support
- 🧾 Bill/Invoice creation with line items
- 📊 Payments & ledger tracking
- 📄 PDF invoice generation (ReportLab)
- 💬 WhatsApp invoice delivery via [OpenWA](https://github.com/rmyndharis/OpenWA)
- ☁️ Cloudinary PDF hosting for WhatsApp sharing
- 📁 Excel export for reports
- 🤖 Gemini AI integration (multi-key rotation)
- 🔐 JWT-based authentication

---

## 🛠️ Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Backend     | FastAPI, SQLAlchemy, Alembic        |
| Frontend    | React 18, Vite, Tailwind CSS        |
| Database    | PostgreSQL                          |
| Auth        | JWT (python-jose)                   |
| PDF         | ReportLab                           |
| Storage     | Cloudinary                          |
| WhatsApp    | OpenWA (rmyndharis/OpenWA)          |
| AI          | Google Gemini API                   |

---

## ⚙️ Setup & Installation

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+
- [OpenWA](https://github.com/rmyndharis/OpenWA) running locally (for WhatsApp)

---

### 1. Clone the Repository

```bash
git clone https://github.com/Kaifmomin57/billsystem.git
cd billsystem
```

---

### 2. Backend Setup

```bash
cd backend

# Create a virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/macOS

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your actual values
```

**Create the PostgreSQL database:**

```sql
CREATE DATABASE billsystem;
```

**Run database migrations:**

```bash
alembic upgrade head
```

**Start the backend server:**

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at `http://localhost:5173`.

---

### 4. Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in the values:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | JWT secret key (use a strong random string) |
| `GEMINI_API_KEY_1..5` | Google Gemini API keys |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `OPENWA_BASE_URL` | OpenWA gateway URL (default: `http://localhost:2785`) |
| `OPENWA_SESSION_ID` | OpenWA session ID (default: `default`) |
| `OPENWA_DELAY_SECONDS` | Delay between WhatsApp messages (default: `60`) |
| `FRONTEND_URL` | Frontend URL for CORS |

---

### 5. WhatsApp Setup (OpenWA)

1. Install and start [OpenWA](https://github.com/rmyndharis/OpenWA)
2. Scan the QR code with your WhatsApp
3. Set `OPENWA_BASE_URL` in your `.env`
4. Use the **Send WhatsApp** button in the Bills page

---

## 📁 Project Structure

```
billsystem/
├── backend/
│   ├── app/
│   │   ├── api/routes/      # FastAPI route handlers
│   │   ├── core/            # Config, database, security
│   │   ├── models/          # SQLAlchemy models
│   │   ├── schemas/         # Pydantic schemas
│   │   └── services/        # Business logic (PDF, WhatsApp, etc.)
│   ├── migrations/          # Alembic migration files
│   ├── uploads/             # Uploaded files (excluded from git)
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Page components
│   │   └── lib/             # API client, utilities
│   ├── public/
│   └── package.json
└── README.md
```

---

## 🔑 Default Credentials

After first run, use the registration endpoint to create an admin user.

> **Note:** Change all default credentials and secret keys before deploying to production.

---

## 📜 License

MIT License — feel free to use and modify.
