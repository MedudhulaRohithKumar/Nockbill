# Kisan Seva Kendra - AWS Serverless Production Deployment Guide

This guide covers the deployment of the Kisan Seva Kendra ERP application onto AWS Serverless infrastructure (AWS Lambda, Amazon RDS PostgreSQL + RDS Proxy, 4 Dedicated S3 Buckets, AWS Step Functions, and Lambda Function URLs transitioning to CloudFront).

---

## 1. Database Architecture & Recommendation

### Why Amazon RDS PostgreSQL + Amazon RDS Proxy is the Optimal Choice
The Kisan Seva Kendra ERP application manages:
- **13 Relational Tables** (Users, Customers, Products, Stock Batches, Invoices, Purchase Bills, Inventory Ledger, GST Transactions, etc.).
- **ACID Transactions**: POS checkout requires atomic inventory deduction with row locks (`SELECT ... FOR UPDATE`), preventing overselling.
- **Complex Financial Analytics**: GSTR-1 quarterly/monthly returns, CGST/SGST 50/50 splits, FIFO stock valuation, and Profit & Loss statements.

| Database Solution | Fit for this ERP | Monthly Cost (Est.) | Pros & Cons |
| :--- | :--- | :--- | :--- |
| **Amazon RDS PostgreSQL + RDS Proxy** *(Recommended for Launch)* | **Best** | **~$20 - $35/mo** | • Zero code rewrite (PostgreSQL standard).<br>• `db.t4g.micro` fits in AWS Free Tier for first 12 months.<br>• **RDS Proxy is essential**: pools connections and prevents Lambda horizontal scaling from exhausting database connections. |
| **Amazon Aurora Serverless v2 + RDS Proxy** *(Recommended for Scale)* | **Best at Scale** | **~$45 - $90/mo** | • Auto-scales compute capacity (0.5 ACU to 128 ACU) in milliseconds.<br>• Instant storage expansion up to 128 TB.<br>• Higher cost baseline for early-stage shops. |
| **Amazon DynamoDB** | **Unsuitable** | Low (~$5/mo) | • Requires complete rewrite of application logic.<br>• Relational joins, multi-table foreign keys, and GST aggregations are extremely inefficient and costly to implement on NoSQL. |
| **Amazon DocumentDB** | **Unsuitable** | High (~$60+/mo) | • MongoDB-compatible; lacks relational foreign-key integrity required for strict financial accounting. |

---

## 2. Dedicated S3 Bucket Organization with Date-wise Folders

All generated documents and reports are automatically segmented across **4 dedicated, private S3 buckets** with AES-256 server-side encryption and public access blocking.

### Bucket Hierarchy
```
├── s3://ks-sales-invoices-<account>-prod/
│   └── YYYY/MM/DD/Invoice_INV-0001.pdf
├── s3://ks-purchase-bills-<account>-prod/
│   └── YYYY/MM/DD/Purchase_PUR-0042.pdf
├── s3://ks-gst-reports-<account>-prod/
│   └── YYYY/MM/DD/GST_Report_2026_09.pdf
└── s3://ks-stock-reports-<account>-prod/
    └── YYYY/MM/DD/Stock_Valuation_2026_09.xlsx
```

### Security & Download Flow
1. **Zero Public S3 Access**: All S3 buckets have `BlockPublicAcls`, `BlockPublicPolicy`, and `IgnorePublicAcls` set to `true`.
2. **Presigned URLs**: Reports are retrieved via temporary, cryptographically signed AWS S3 Presigned URLs valid for 15 minutes (`settings.s3_presigned_url_expire_seconds = 900`).
3. **Lifecycle Policies**:
   - Invoices and purchase bills automatically move to `STANDARD_IA` after 90 days and `GLACIER` after 365 days, cutting long-term storage costs by over 75%.

---

## 3. Compute Architecture: Dual Lambda & Step Functions

### Backend Lambda (FastAPI Container)
- Packaged as an AWS ECR container image (`backend/Dockerfile.lambda`) based on `public.ecr.aws/lambda/python:3.11`.
- Includes Tesseract OCR, Poppler, and ReportLab.
- Uses **Mangum ASGI Adapter** configured with `lifespan="off"` for high-throughput HTTP handling.
- Connects securely to the database through **Amazon RDS Proxy** within the private VPC subnet.

### Frontend Lambda (React SPA Server)
- Serves the compiled production React single-page application (`frontend/dist/`).
- Routes all virtual SPA paths (`/`, `/billing`, `/inventory`, `/reports`, etc.) to `index.html`.
- Serves static assets (`/assets/*`, fonts, images) with `Cache-Control: public, max-age=31536000, immutable`.
- Serves HTML documents with `Cache-Control: no-cache, no-store, must-revalidate` to prevent stale client builds.

### Step Functions Workflows (Separated Backend & Frontend)
1. **Backend Monthly Reports Workflow (`step_functions_backend_reports.json`)**:
   - Executes monthly scheduled financial audits.
   - Concurrently generates GSTR-1 PDF and Stock Valuation Excel.
   - Saves generated files to their respective S3 buckets under `YYYY/MM/DD/`.
   - Sends an SNS email alert to the shop owner with secure one-click download links.
2. **Frontend Deployment & Warmup Workflow (`step_functions_frontend_deploy.json`)**:
   - Validates distribution integrity (`index.html` + asset bundle existence).
   - Prewarms Lambda execution containers to eliminate cold starts.
   - Invalidates CloudFront edge caches upon deployment.

---

## 4. Security & Content Security Policy (CSP)

The application implements enterprise-grade HTTP security headers in [SecurityHeadersMiddleware](file:///Users/pro/Desktop/ks/backend/app/middleware/security.py) and [frontend/lambda_handler.py](file:///Users/pro/Desktop/ks/frontend/lambda_handler.py):

| Header | Value | Purpose |
| :--- | :--- | :--- |
| **Content-Security-Policy** | `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https:; frame-ancestors 'none'; object-src 'none'; base-uri 'self';` | Blocks XSS, unauthorized framing, and malicious script injections while permitting Google Fonts, local blobs, and API calls. |
| **Permissions-Policy** | `camera=(self), microphone=(), geolocation=()` | **Enables camera access for the POS barcode scanner** while blocking microphone and geolocation leaks. |
| **X-Content-Type-Options** | `nosniff` | Prevents MIME-type sniffing attacks. |
| **X-Frame-Options** | `DENY` | Prevents clickjacking attacks. |
| **Strict-Transport-Security** | `max-age=31536000; includeSubDomains; preload` | Enforces HTTPS. |
| **Server & X-Powered-By** | *Stripped / Removed* | Obscures runtime fingerprints (Uvicorn, FastAPI, Python) from penetration scanners. |

---

## 5. Deployment Instructions

### Prerequisites
- AWS CLI configured (`aws configure`) with administrative credentials.
- AWS SAM CLI installed (`sam --version`) or CloudFormation.
- Docker running locally (for building the backend Lambda container image).

### Step 1: Build Frontend Production Assets
```bash
cd /Users/pro/Desktop/ks/frontend
npm run build
```

### Step 2: Deploy Infrastructure via AWS SAM
```bash
cd /Users/pro/Desktop/ks/infrastructure

sam build -t cloudformation_serverless.yaml
sam deploy --guided \
  --stack-name ks-serverless-prod \
  --capabilities CAPABILITY_IAM \
  --region ap-south-1
```
*Prompts will request parameters such as `DbUsername`, `DbPassword`, and `ReportNotificationEmail`.*

### Step 3: Seed Initial Database & Alembic Migrations
Run the database migrations against the RDS Proxy endpoint:
```bash
cd /Users/pro/Desktop/ks/backend
export DATABASE_URL="postgresql://kisan_admin:<password>@<rds-proxy-endpoint>:5432/kisan_seva_db"
alembic upgrade head
python seed_data.py
```

### Step 4: Access Application via Function URLs
Once deployed, CloudFormation Outputs will display your URLs:
- **Frontend SPA URL**: `https://<frontend-lambda-id>.lambda-url.ap-south-1.on.aws/`
- **Backend API URL**: `https://<backend-lambda-id>.lambda-url.ap-south-1.on.aws/`

---

## 6. Phase 2: Attaching Custom Domain (CloudFront CDN + Route53)

When you purchase your domain name (e.g. `kisansevakendra.in`):

1. **Request an SSL Certificate** in AWS Certificate Manager in `us-east-1` (N. Virginia):
   ```bash
   aws acm request-certificate \
     --domain-name app.kisansevakendra.in \
     --validation-method DNS \
     --region us-east-1
   ```
2. **Deploy the CloudFront Distribution** using `cloudfront_custom_domain.yaml`:
   ```bash
   aws cloudformation deploy \
     --template-file cloudfront_custom_domain.yaml \
     --stack-name ks-cloudfront-domain \
     --parameter-overrides \
         DomainName=kisansevakendra.in \
         Subdomain=app \
         FrontendFunctionUrlDomain=<frontend-lambda-id>.lambda-url.ap-south-1.on.aws \
         BackendFunctionUrlDomain=<backend-lambda-id>.lambda-url.ap-south-1.on.aws \
         AcmCertificateArn=<your-acm-arn-from-step-1>
   ```
3. **Add CNAME Record in your Domain Registrar / Route53**:
   - `CNAME` for `app.kisansevakendra.in` -> `<distribution-id>.cloudfront.net`.
4. Now, all traffic accesses `https://app.kisansevakendra.in`:
   - `/api/*` routes straight to the Backend FastAPI Lambda.
   - `/*` serves the Frontend SPA with global edge caching.
