# NockBill Solutions (formerly Kisan Seva Kendra) - AWS Serverless Production Deployment Guide

This guide covers the deployment of the NockBill Solutions ERP application onto AWS Serverless infrastructure (AWS Lambda, Amazon RDS PostgreSQL + RDS Proxy, 4 Dedicated S3 Buckets, AWS Step Functions, and Lambda Function URLs transitioning to CloudFront) using **GitHub Actions CI/CD**.

---

## 1. Database Architecture & Decision

### Can You Run a Database in Docker on AWS Lambda?
> [!CAUTION]
> **No — running a database inside Docker on AWS Lambda is fundamentally broken and will cause severe data loss.**
> 
> Here is why running a database engine inside Lambda does not work:
> 1. **Lambda is Ephemeral & Stateless**: Lambda instances shut down when idle. When the container recycles, **all data written to disk or container storage is erased permanently**.
> 2. **Execution Freezing**: When there are no active HTTP requests, Lambda completely freezes the container CPU. A database daemon (like PostgreSQL) cannot perform background tasks, write ahead logs (WAL), or maintain transaction locks while frozen.
> 3. **Horizontal Concurrency Splits the Database**: If two users make requests at the same time, Lambda launches two isolated container instances. Each container would have its own independent, out-of-sync database. An invoice created in Container 1 would never exist in Container 2!
> 4. **No Listening Port**: Lambda cannot open port 5432 to external clients; it only invokes code via the Lambda Runtime API.

---

### What Database Should You Use for a New AWS Account?

| Option | Cost on New AWS Account | Recommendation | Why |
| :--- | :--- | :--- | :--- |
| **Amazon RDS PostgreSQL (`db.t4g.micro`) + RDS Proxy** *(Already configured in this repo!)* | **$0 / month (100% FREE for 12 months in AWS Free Tier)** | **Recommended (Production Standard)** | AWS provides 750 hours/month of `db.t4g.micro` free for the first 12 months + 20 GB storage. Full ACID compliance, automated daily backups, and connection pooling via RDS Proxy. |
| **Serverless PostgreSQL (Neon.tech / Supabase)** | **$0 / month (Forever Free Tier)** | **Alternative (Quickest Setup)** | Zero VPC setup required. You get a direct PostgreSQL connection string with built-in connection pooling that connects over SSL from Lambda. |
| **Docker PostgreSQL on a small EC2 (`t4g.micro`)** | **$0 / month in Free Tier (or ~$3/mo)** | **Alternative (If you must use Docker)** | Run PostgreSQL inside Docker on a small persistent EC2 instance with an attached EBS volume instead of Lambda. |

**Verdict**: Because you have a **new AWS account**, **Amazon RDS PostgreSQL `db.t4g.micro` is 100% free** for your first 12 months. Your CloudFormation template (`cloudformation_serverless.yaml`) is already configured with this.

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

## 3. GitHub Actions CI/CD Setup for Your New AWS Account

Every `git push` to `main` or `Dev` automatically builds the frontend React SPA, builds the backend container image, and deploys the entire infrastructure to your new AWS account via `.github/workflows/deploy.yml`.

### Step 1: Create an IAM User in Your New AWS Account
1. Log in to the [AWS Management Console](https://console.aws.amazon.com/) of your **new AWS account**.
2. Navigate to **IAM** → **Users** → click **Create user**.
3. Name: `github-actions-deployer`.
4. Attach the following policies directly:
   - `AdministratorAccess` (or custom policy with CloudFormation, Lambda, RDS, IAM, S3, Secrets Manager, ECR, and VPC permissions).
5. Click **Next** → **Create user**.
6. Select the user → **Security credentials** tab → **Create access key** → select **Third-party service (e.g. GitHub Actions)**.
7. Save the **Access Key ID** and **Secret Access Key**.

---

### Step 2: Add Secrets to Your GitHub Repository
1. In your GitHub repository, go to **Settings** → **Secrets and variables** → **Actions**.
2. Click **New repository secret** and add the following 5 secrets:

| Secret Name | Value Example | Description |
| :--- | :--- | :--- |
| `AWS_ACCESS_KEY_ID` | `AKIAIOSFODNN7EXAMPLE` | Access Key from your new AWS account |
| `AWS_SECRET_ACCESS_KEY` | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` | Secret Key from your new AWS account |
| `AWS_REGION` | `ap-south-1` | AWS Region (e.g., `ap-south-1` for Mumbai) |
| `DB_PASSWORD` | `NockBillSecurePass2026!` | Master password for your RDS PostgreSQL database (Min 8 characters) |
| `REPORT_NOTIFICATION_EMAIL` | `owner@example.com` | Your email address to receive monthly GST & financial reports |

---

### Step 3: Trigger Deployment
Once secrets are saved:
1. Push any commit to `Dev` or `main`:
   ```bash
   git push origin Dev
   ```
2. Or go to your GitHub repository → **Actions** tab → **Deploy Kisan Seva Kendra to AWS Serverless** → click **Run workflow**.

GitHub Actions will execute:
- Frontend asset bundle build (`npm run build`).
- Container compilation of backend FastAPI image via AWS SAM.
- Automatic creation of the ECR repository, VPC, Subnets, RDS PostgreSQL Free Tier instance, RDS Proxy, S3 Buckets, Step Functions, and Lambda Functions.
- Prints the live **Frontend URL** and **Backend URL** directly in the GitHub Actions log!

---

## 4. Manual Deployment via AWS CLI (Alternative)

If you ever want to run a deployment manually from your local terminal:

```bash
# 1. Build Frontend
cd /Users/pro/Desktop/ks/frontend
npm run build

# 2. Build SAM Application
cd /Users/pro/Desktop/ks/infrastructure
sam build -t cloudformation_serverless.yaml

# 3. Deploy
sam deploy \
  --config-file samconfig.toml \
  --resolve-s3 \
  --resolve-image-repos \
  --parameter-overrides \
    Environment="prod" \
    DbUsername="kisan_admin" \
    DbPassword="YourSecurePasswordHere!" \
    DbAllocatedStorage="20" \
    VpcCidr="10.0.0.0/16" \
    ReportNotificationEmail="your-email@example.com"
```

---

## 5. Attaching Custom Domain (CloudFront CDN + Route53)

When ready to point your custom domain (e.g. `app.nockbill.com`):

1. **Request an SSL Certificate** in AWS Certificate Manager in `us-east-1` (N. Virginia):
   ```bash
   aws acm request-certificate \
     --domain-name app.nockbill.com \
     --validation-method DNS \
     --region us-east-1
   ```
2. **Deploy the CloudFront Distribution** using `cloudfront_custom_domain.yaml`:
   ```bash
   aws cloudformation deploy \
     --template-file cloudfront_custom_domain.yaml \
     --stack-name ks-cloudfront-domain \
     --parameter-overrides \
         DomainName=nockbill.com \
         Subdomain=app \
         FrontendFunctionUrlDomain=<frontend-lambda-id>.lambda-url.ap-south-1.on.aws \
         BackendFunctionUrlDomain=<backend-lambda-id>.lambda-url.ap-south-1.on.aws \
         AcmCertificateArn=<your-acm-arn-from-step-1>
   ```
3. Add the `CNAME` record in your DNS provider pointing to `<distribution-id>.cloudfront.net`.
         BackendFunctionUrlDomain=<backend-lambda-id>.lambda-url.ap-south-1.on.aws \
         AcmCertificateArn=<your-acm-arn-from-step-1>
   ```
3. **Add CNAME Record in your Domain Registrar / Route53**:
   - `CNAME` for `app.kisansevakendra.in` -> `<distribution-id>.cloudfront.net`.
4. Now, all traffic accesses `https://app.kisansevakendra.in`:
   - `/api/*` routes straight to the Backend FastAPI Lambda.
   - `/*` serves the Frontend SPA with global edge caching.
