# Kisan Seva Kendra - Fertilizer Shop Management & Billing Application

A modern, production-grade **Fertilizer Shop Management, Billing, Inventory, GST, and Financial Reporting Web Application** built with **FastAPI, React, TypeScript, Tailwind CSS, and AI-powered OCR Camera Scanning**.

Designed specifically for fertilizer, seeds, and agro-chemical retail dealers in India with mobile-friendly camera scanning, Aadhaar DBT support, and statutory compliance.

---

## 🌟 Key Highlights

- 📱 **Mobile Camera OCR Scanner**: Take a picture of any fertilizer bag (Urea, DAP, NPK, Potash) or pesticide bottle directly using your phone's camera. The system auto-extracts product name, batch number, expiry date, MRP, and HSN code using computer vision OCR.
- 🧾 **One-Click GST POS Billing**: Instant customer invoice generation with automatic CGST, SGST, and IGST calculation. Add items directly from the OCR camera scan or quick inventory search. Supports Cash, UPI QR code, Card, and Udhar/Credit.
- 📦 **Automated Inventory & Stock Alerts**: Real-time godown stock tracking, automatic deduction on billing, inward purchase stocking, low-stock notifications, and 60-day expiry warnings.
- 📊 **GST & Financial Reports**: GSTR-1 compliant rate-wise breakdown, Sales Register, Stock Balance valuation (cost vs retail margin), and Profit & Loss (P&L) statements taking into account freight, labor, and shop expenses.
- 🖨️ **Thermal & A4 Print / PDF**: Generates professional GST Tax Invoices formatted with shop license numbers (Fertilizer, Pesticide, Seed), bank details, UPI ID, and terms & conditions.

---

## 🏗️ Architecture & Technology Stack

```
fertilizer_poc/
├── backend/                  # FastAPI Python Backend
│   ├── app/
│   │   ├── config/           # Application settings & environment
│   │   ├── database/         # SQLAlchemy 2.0 ORM base & engine
│   │   ├── models/           # 9 DB tables (products, sales, purchases, etc.)
│   │   ├── schemas/          # Pydantic validation schemas
│   │   ├── routers/          # REST API endpoints (auth, sales, products, ocr...)
│   │   ├── ocr/              # Tesseract OCR & OpenCV image processing engine
│   │   ├── reports/          # PDF invoice & Excel generator (ReportLab)
│   │   └── main.py           # FastAPI application entry point
│   ├── seed.py               # Database seeder with sample fertilizer data
│   ├── requirements.txt      # Python dependencies
│   └── Dockerfile            # Container definition with Tesseract OCR
│
├── frontend/                 # React + TypeScript + Vite Frontend
│   ├── src/
│   │   ├── api/              # Axios HTTP client with JWT interceptors
│   │   ├── components/
│   │   │   ├── layout/       # AppLayout (Sidebar, Mobile Bottom Nav)
│   │   │   ├── ocr/          # CameraScannerModal (Live webcam, phone capture)
│   │   │   └── billing/      # InvoiceReceiptModal, Product search
│   │   ├── pages/            # Dashboard, Billing, Inventory, Purchases, Reports, Settings
│   │   ├── context/          # AuthContext & ShopContext
│   │   └── types/            # TypeScript data contracts
│   ├── package.json          # Node dependencies
│   ├── vite.config.ts        # Vite configuration with LAN host (0.0.0.0)
│   └── tailwind.config.js    # Custom agricultural emerald palette
│
└── docker-compose.yml        # Multi-container orchestration (DB, API, Web)
```

---

## 🚀 How to Run

### Method 1: Docker (Recommended - One Command)

Prerequisites: Docker & Docker Compose installed.

```bash
docker-compose up --build
```
- Access Web App: `http://localhost:5173`
- Access Backend API Docs: `http://localhost:8000/docs`

---

### Method 2: Local Development Setup

#### 1. Backend Setup (FastAPI)

```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python seed.py
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 2. Frontend Setup (React + Vite)

```bash
cd frontend
npm install
npm run dev -- --host
```

Access the frontend at `http://localhost:5173`.
Because `--host` is enabled, you can also open `http://<YOUR_PC_IP>:5173` from your smartphone connected to the same Wi-Fi network!

---

## 📷 How to Use Phone Camera OCR Scanning

1. Open the application on your smartphone or desktop browser.
2. Go to **Billing** or **Dashboard** and tap **"OCR Camera Scan"**.
3. Point your camera at a fertilizer sack (e.g., IFFCO Urea, DAP) or chemical bottle label.
4. Tap **"Capture & Extract Text"** (or use the **Sample Fertilizers** tab if testing on PC without a physical fertilizer bag).
5. The AI parser automatically identifies:
   - **Product Name** (matched against your inventory)
   - **Batch Number**
   - **Expiry Date**
   - **MRP & Selling Rate**
   - **HSN Code & GST Rate**
6. Review the values, adjust quantity if needed, and tap **"Add Product to Bill"**.

---

## 🔐 Default Demo Credentials

| Role | Username | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Shop Owner** | `admin` | `admin123` | Full Access (All features, Reports, Settings) |
| **Billing Operator** | `operator` | `operator123` | POS Billing & Inventory View |

---

## ⚖️ GST Compliance

Fertilizer retail in India follows specific GST and subsidy regulations:
- **Fertilizers (Urea, DAP, MOP, NPK)**: 5% GST (CGST 2.5% + SGST 2.5% for intra-state, or 5% IGST for inter-state).
- **Pesticides & Fungicides**: 18% GST (CGST 9% + SGST 9%).
- **Micronutrients & Plant Growth Regulators**: 12% or 18% GST.
- **Aadhaar DBT Linking**: The billing module includes optional Aadhaar card entry for farmers purchasing subsidized urea/fertilizers under direct benefit transfer schemes.
