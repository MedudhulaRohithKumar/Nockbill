# NockBill — System Design System & UI/UX Specification (`DESIGN.md`)

> **Product**: NockBill Solutions (AgriTech & Rural Commerce ERP / POS)  
> **Target Audience**: Fertilizer, Seeds & Pesticides Retailers, Agri-Input Distributors, Farmers & Agri-Inspectors  
> **Design Philosophy**: High-Trust Modern Agri-Fintech — fast keyboard-driven POS counter billing, high-contrast readability in bright sunlight, strict regulatory compliance, and accessible touch ergonomics for rural store owners.

---

## 1. Brand Identity & Color Tokens

### 1.1 Core Palette
NockBill's visual identity balances agricultural vibrancy with enterprise-grade fintech authority.

| Token | Hex Value | Tailwind Class | Usage |
| :--- | :--- | :--- | :--- |
| **Brand Primary (Forest)** | `#15803d` | `bg-emerald-700` / `text-emerald-700` | Primary buttons, active nav states, brand badges |
| **Brand Primary Dark** | `#14532d` | `bg-emerald-900` / `text-emerald-900` | Header bars, active tab highlights, strong emphasis |
| **Brand Surface Light** | `#ecfdf5` | `bg-emerald-50` / `border-emerald-200` | Selected card states, success panels, soft badges |
| **Background Neutral** | `#f8fafc` | `bg-slate-50` | Main application shell and viewport canvas |
| **Surface Card** | `#ffffff` | `bg-white` | Content containers, modal dialogs, data tables |
| **Border Neutral** | `#e2e8f0` | `border-slate-200` | Divider lines, card outlines, table gridlines |
| **Text Dominant** | `#0f172a` | `text-slate-900` | Headings, invoice total, primary data points |
| **Text Secondary** | `#64748b` | `text-slate-500` | Supporting text, table captions, helper instructions |

### 1.2 Status & Functional Accents
| Intent | Background | Text / Border | Purpose |
| :--- | :--- | :--- | :--- |
| **Credit / Outstanding** | `#fef3c7` (`amber-50`) | `#b45309` (`amber-700`) | Farmer credit dues, pending payables, payment alerts |
| **Compliance / Regulatory** | `#e0f2fe` (`sky-50`) | `#0284c7` (`sky-700`) | Form O, Pesticide license alerts, Agri-Inspector checks |
| **Stock Critical / Expiry** | `#ffe4e6` (`rose-50`) | `#e11d48` (`rose-600`) | Batches nearing expiry (<90 days), zero stock warnings |
| **Success / Paid** | `#dcfce7` (`emerald-50`) | `#15803d` (`emerald-700`) | Completed transactions, settled khata, verified batches |
| **IAM / Security** | `#f3e8ff` (`purple-50`) | `#7e22ce` (`purple-700`) | AWS IAM user roles, admin badges, permission chips |

---

## 2. Typography & Hierarchy

### 2.1 Font Families
- **Display & UI Interface**: `Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
  - Crisp readability at dense table scales.
- **Monospace (Numbers, Codes & Invoices)**: `JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
  - Used for Currency values (`₹1,450.00`), HSN/SAC codes, Batch IDs, Barcodes, and UPI Transaction References.

### 2.2 Scale & Weight Mapping
- **Hero Title**: `text-2xl font-black text-slate-900 tracking-tight` (Page Titles, Daily Total Sales)
- **Section Heading**: `text-lg font-bold text-slate-900` (Modal headers, Card titles)
- **Data Metric / Number**: `text-xl font-black font-mono` (KPI cards, invoice totals)
- **Body Regular**: `text-sm font-normal text-slate-700` (Descriptions, notes)
- **Form Label**: `text-xs font-bold uppercase tracking-wider text-slate-500` (Input labels)
- **Micro Badge**: `text-[10px] font-bold uppercase px-2 py-0.5 rounded-full` (Status chips)

---

## 3. Layout & Navigation Architecture

```
+------------------------------------------------------------------------------------+
|  [NockBill Logo]  Store Name (License Verified)       [Shift Handover] [IAM User: Owner] |
+------------------+-----------------------------------------------------------------+
| SIDEBAR          | MAIN WORKSPACE CANVAS                                           |
| - Quick Billing  |  +------------------------------------------------------------+ |
| - Products/Stock |  | Active Module Header & Contextual Filters                  | |
| - Sales History  |  +------------------------------------------------------------+ |
| - Purchases      |  |                                                            | |
| v Khata Ledgers  |  | [Dropdown / Tab Module Selector]                           | |
|   * Farmer Ledger|  |                                                            | |
|   * Suppliers    |  | Content Area / High-Density Grid / Responsive Data Table   | |
|   * Clearance    |  |                                                            | |
|   * Cash Shift   |  |                                                            | |
|   * Form O       |  |                                                            | |
| - Agri Doctor AI |  +------------------------------------------------------------+ |
| - Marketing Hub  |                                                                 |
| - Reports        |                                                                 |
| v Shop Mgmt      |                                                                 |
|   * IAM Users    |                                                                 |
|   * Invoice Build|                                                                 |
|   * Settings     |                                                                 |
+------------------+-----------------------------------------------------------------+
```

### 3.1 Responsive Breakpoints
- **Desktop (>= 1024px)**: Fixed 260px collapsible sidebar, multi-column POS counter (Cart left, Product quick-search right).
- **Tablet (768px - 1023px)**: Slim icon-based sidebar, stacked billing panels.
- **Mobile (< 768px)**: Slide-out drawer navigation, sticky bottom action bar (`Charge ₹Total`), 48px touch-friendly hit areas.

---

## 4. Component Design Specifications

### 4.1 Buttons
- **Primary Action**: `bg-brand-700 hover:bg-brand-800 text-white font-bold px-4 py-2.5 rounded-xl shadow-sm transition active:scale-[0.98]`
- **Secondary / Outline**: `bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold px-4 py-2.5 rounded-xl transition`
- **Danger Action**: `bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold px-3 py-2 rounded-xl transition`
- **Icon Quick-Action**: `w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100`

### 4.2 Form Inputs & Controls
- **Standard Input**: `w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-brand-500 rounded-xl text-sm font-medium text-slate-900 focus:ring-2 focus:ring-brand-500/20 outline-none transition`
- **Search Inputs**: With leading search icon, instant debounce (150ms), and clear button.
- **Labels**: Always explicitly associated with `id` & `htmlFor` attributes (Zero SonarQube `S6853` issues).

### 4.3 Data Tables
- Header: `bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500 px-4 py-3`
- Rows: `hover:bg-slate-50/80 transition-colors border-b border-slate-100 text-sm`
- Numeric columns (Quantity, Rate, Tax, Total): Right-aligned with tabular numbers.

---

## 5. Specialized Feature Modules & New Additions

### 5.1 Shop Management & AWS-Style IAM Console
Provides multi-user security and separation of duties for retail agro-dealers.

- **IAM User Hierarchy**:
  1. **Owner (`ROOT`)**: Full administrative access, tenant settings, billing subscriptions, staff salary/deletions, invoice customization.
  2. **Store Manager (`MANAGER`)**: Inventory batch inwards, supplier invoice entry, farmer credit approvals, price changes.
  3. **Counter Cashier (`CASHIER`)**: POS billing, cash drawer collection, shift handover creation, sales returns. Restricted from editing purchase prices or deleting sales.
  4. **Agronomist / Field Advisor (`ADVISOR`)**: Agri Doctor diagnoses, WhatsApp seasonal broadcast campaigns, farmer farm records.
- **AWS-Style Login UX**:
  - Store Identifier / Shop Slug (`e.g., green-valley-agro`)
  - IAM Username (`e.g., cashier_counter1`)
  - Password + Session Token verification
  - Role badge indicator pinned in application topbar.

### 5.2 Dynamic Invoice Builder & Template Models
Store owners can customize their physical and digital receipts to fit their printer hardware and brand aesthetics.

- **Template Variations**:
  1. **Template A: Standard A4 Tax Invoice (GST / Government Regulated)**
     - Full itemized table with HSN codes, Batch No, Expiry Date, Chemical Active Ingredient, CGST/SGST/IGST split.
     - Farmer details: Name, Mobile, Village, Aadhaar / Land ID (Form O compliance).
     - Store logo, bank RTGS/NEFT details, dynamic UPI QR code.
  2. **Template B: 3-inch (80mm) Thermal POS Receipt**
     - Optimized for high-speed thermal printers (Epson, TVS, Citizen).
     - High-contrast black/white mono layout, truncated product names, batch & exp footer.
     - Dynamic UPI QR at bottom for instant farmer mobile scan.
  3. **Template C: Agri Regulatory Form O / Pesticide Compliance Slip**
     - Includes statutory declarations required by State Agriculture Officers and Fertilizer Inspectors.
     - Mandatory dealer license numbers printed under the store header.
  4. **Template D: Clean Modern Minimalist**
     - Contemporary card-based bill summary with store accent color, subtle divider rules, and WhatsApp share button.
- **Invoice Customization Settings**:
  - Logo uploader (PNG/JPG auto-resized and cached).
  - Header Accent Color Picker.
  - Custom Terms & Conditions text area.
  - Show/Hide columns toggle (HSN, Batch, Expiry, Discount %, Savings tag).

### 5.3 General Shop Settings
- Business Legal Name & Display Brand Name
- Multi-Category License Registry:
  - Fertilizer License No.
  - Pesticide License No.
  - Seed License No.
- GSTIN & PAN registration
- Official UPI VPA ID & Bank details for automated QR generation
- State Jurisdiction for automatic Intra-State (CGST + SGST) vs Inter-State (IGST) calculation.

### 5.4 Agri Doctor Diagnostic Engine & WhatsApp Marketing Hub
- **Agri Doctor**:
  - Visual selection of target crop (Cotton, Paddy, Wheat, Chilli, Sugarcane, Maize, Tomato, Soybean, Gram).
  - Pest/disease symptom diagnosis (e.g., Pink Bollworm, Blast, Yellow Rust, Leaf Curl).
  - Recommended technical active ingredients with accurate dosages.
  - 1-Click WhatsApp advisory dispatch to farmer with prescribed products in stock.
- **Seasonal WhatsApp Broadcast Engine**:
  - Stage-based broadcast triggers (Pre-sowing, Basal fertilizer dose, Flowering booster, Harvest).
  - Pure English, professional merchant-customizable templates.
  - Integrated payment reminder links with automated ledger balances.

---

## 6. Regulatory & Security Design Rules

1. **Multi-Tenant Scoping**: Every database read/write is strictly scoped by authenticated `shop_id`.
2. **Pure English Localization**: No Hindi script or Romanized Hindi placeholders in dashboard controls, templates, or system notifications.
3. **Audit Trails**: All credit ledger mutations, cashier handovers, and invoice prints record the acting IAM `user_id` and timestamp.
4. **Zero-Token Storage**: No JWT tokens stored in browser `localStorage` or `sessionStorage` (strict httpOnly cookies).
5. **Zero SonarQube Issues**: Zero accessibility, autoFocus, or regex defects across all React views.
