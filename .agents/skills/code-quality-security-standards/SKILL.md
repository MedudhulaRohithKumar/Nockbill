---
name: code-quality-security-standards
description: >-
  Enforces zero SonarQube/SonarCloud issues, >90% test coverage, zero Trivy
  vulnerability and misconfiguration findings, secure dependency management,
  and production-grade system and API design principles across backend,
  frontend, Docker, CI/CD, and IaC changes. Activate before writing,
  refactoring, or reviewing code, dependencies, Dockerfiles, or infrastructure.
---

# Code Quality, Security & Architecture Standards

Follow this runbook on every feature, bug fix, refactor, dependency update, or infrastructure change in this repository.

## 1. Zero SonarQube / SonarCloud Issues

Every modified or newly added file must produce **0 Bugs, 0 Vulnerabilities, 0 Code Smells, and 0 unreviewed Security Hotspots**.

### Frontend (TypeScript / React)
- **ES2015+ `Number` APIs (`typescript:S7773`)**: Always use `Number.parseInt`, `Number.parseFloat`, `Number.isNaN`, and `Number.isFinite` — never bare global `parseInt`, `parseFloat`, `isNaN`, or `isFinite`.
- **Form Accessibility (`typescript:S6853`, `typescript:S9379`)**: Every `<label>` must either specify `htmlFor` matching a control `id` or directly wrap its form control (`<input>`, `<select>`, `<textarea>`, `<CustomSelect>`). Never use `autoFocus`.
- **Interactive Elements (`typescript:S6848`)**: Use native `<button type="button">` or `<a>` for clickable elements. Never attach `onClick` to non-interactive elements (`<div>`, `<span>`) without full ARIA role, `tabIndex`, and keyboard (`Enter`/`Space`) handling.
- **Locale-Aware Sorting (`javascript:S2814`)**: Never call `.sort()` without an explicit compare function (use `(a, b) => a.localeCompare(b)` for strings and `(a, b) => a - b` for numbers).
- **Safe Regex (`typescript:S8786`)**: Avoid nested/unbounded quantifiers that risk polynomial backtracking (ReDoS); bound repetitions and keep character classes disjoint.
- **Client Storage Security (`tssecurity:S8475`)**: Never write auth tokens, credentials, or sensitive PII to `localStorage` or `sessionStorage`. Rely on `HttpOnly`, `Secure`, `SameSite` cookies.
- **Clean TypeScript & Complexity**: Zero unused imports/variables, explicit types over `any` where practical, and decompose large components/functions to keep cognitive complexity low.

### Backend (Python / FastAPI)
- **Explicit Optional Defaults (`python:S8396`)**: Every `Optional[T]` Pydantic field must define an explicit default (`= None` or `Field(default=None, ...)`). Never use bare `Optional[T]` or `Field(...)` on optional fields.
- **No Duplicated Literals (`python:S1192`)**: Extract string literals repeated 3+ times into module-level constants.
- **Timezone-Aware Timestamps**: Always use `datetime.now(timezone.utc)` — never deprecated `datetime.utcnow()`.
- **Safe Equality & Clean Branches**: Avoid direct float equality (`==`) on computed floats (`math.isclose` / `Decimal`), avoid duplicate `if/elif` branches, and remove unused imports.

### Docker, CI/CD & CloudFormation (IaC)
- **Pinned Images & Dependencies (`docker:S8544`)**: Pin base images to specific patch tags or immutable digests (never `:latest` or floating minor tags), pin Python packages with exact `==` versions, and use `npm ci --ignore-scripts` with committed `package-lock.json`.
- **Non-Root Containers (`docker:S6585`) & Minimal Copies (`docker:S6470`)**: Run containers as a dedicated non-root user and copy only required application files.
- **HTTPS Redirect Enforcement (`githubactions:S6506`)**: Always pass `--proto "=https"` with `curl -L` and pin GitHub Actions to full commit SHAs.
- **CloudFormation Security**: Enable encryption at rest (`StorageEncrypted: true`, S3 AES256/KMS), enforce `PublicAccessBlockConfiguration` on all S3 buckets, set RDS `BackupRetentionPeriod >= 7`, and configure access logging (`LoggingConfiguration` on S3 buckets, `Logging` on CloudFront distributions).

---

## 2. Test Coverage Gate (> 90%)

- Maintain **strictly > 90% line and branch coverage** across both backend (`coverage.xml`) and frontend (`frontend/coverage/lcov.info`).
- Every new endpoint, service helper, validator, UI rule engine, or bug fix **must ship with automated tests** covering:
  - Happy paths and boundary values
  - Error / validation failure paths and authorization failures
  - Edge cases (empty/null inputs, legacy data compatibility, multi-tenant isolation)
- Never inflate coverage with no-op tests; assert meaningful behavior and regressions.

---

## 3. Zero Trivy Scan Issues & No Vulnerable Packages

- **Zero CVEs & Misconfigurations**: `trivy fs`, `trivy config`, and `trivy image` scans must report **0 CRITICAL, 0 HIGH, and 0 MEDIUM** findings (vulnerabilities, secrets, and IaC misconfigurations).
- **Dependency Hygiene**:
  - Never add packages with known unpatched CVEs, deprecated/unmaintained libraries, or unpinned version ranges (`>=`, `^`, `~`, `*`).
  - Prefer well-maintained packages with active security support or standard library / built-in platform APIs over unnecessary third-party dependencies.
  - Keep `backend/requirements.txt` pinned with exact `==` versions and `frontend/package-lock.json` committed and synchronized.
  - Never commit secrets, API keys, private keys, or credentials anywhere in source, configs, tests, or `.env` files.

---

## 4. System & API Design Principles

### System Architecture
- **Multi-Tenant Isolation**: Scope every database query, mutation, lookup, and file/S3 key strictly by `shop_id` (derived from the authenticated user, never trusted from client payloads).
- **Data Integrity & Concurrency**: Wrap multi-step state mutations (billing, stock refills, returns, adjustments) in atomic database transactions with row-level locking (`with_for_update()`) to prevent race conditions and deadlocks.
- **Performance & Scalability**: Prevent N+1 queries with eager loading (`selectinload` / `joinedload`), enforce bounded pagination (`skip`/`limit`) on list endpoints, index frequent filter/join columns, and use `Decimal` (never binary floats) for all monetary and tax calculations.
- **Modularity & Maintainability**: Separate configuration/rules, validation schemas, business services, persistence models, and UI presentation into focused, reusable modules.

### REST API Design
- **Predictable Resource Naming**: Use lowercase plural nouns (`/api/products`, `/api/sales`, `/api/price-lists`), proper HTTP verbs (`GET`, `POST`, `PUT`/`PATCH`, `DELETE`), and accurate status codes (`200`, `201`, `204`, `400`, `401`, `403`, `404`, `409`, `422`, `500`).
- **Strict Boundary Validation & Sanitization**: Validate and sanitize all request inputs at the API boundary using Pydantic v2 schemas (`min_length`, `max_length`, numeric bounds, HTML/script stripping, code sanitization). Reject malformed or negative business values early with clear, structured error details.
- **Idempotency & Safe Retries**: Support idempotency keys on financial/transactional creation endpoints (e.g., sales/billing) and duplicate-detection checks before creating master records.
- **Backward Compatibility**: Evolve schemas additively (nullable/defaulted fields, safe auto-migrations) so existing clients and database rows never break on upgrade.
- **Security & Observability**: Enforce authentication/RBAC (`owner` vs `staff`) on every protected route, record `AuditLog` entries for sensitive mutations, apply strict security headers (CSP, HSTS, `X-Content-Type-Options`), and never leak stack traces or internal secrets in error responses.

---

## 5. Mandatory Pre-Completion Verification

Run these checks before finalizing changes:

1. **Backend Tests & Coverage (> 90%)**:
   ```sh
   python3 backend/tests/generate_coverage_xml.py
   # Or in CI / full venv with pytest-cov:
   pytest backend/tests --cov=backend/app --cov-branch --cov-fail-under=90 --cov-report=xml:coverage.xml
   ```
2. **Frontend Type Check, Build & Quality/Coverage Suite**:
   ```sh
   ./frontend/node_modules/.bin/tsc -p frontend/tsconfig.json --noEmit
   node frontend/scripts/run_coverage.mjs
   ./frontend/node_modules/.bin/vite build frontend
   ```
3. **Trivy Security & IaC Scan (when `trivy` is installed)**:
   ```sh
   trivy fs --scanners vuln,secret,misconfig --severity MEDIUM,HIGH,CRITICAL --exit-code 1 .
   trivy config --severity MEDIUM,HIGH,CRITICAL --exit-code 1 infrastructure/ backend/ frontend/
   ```
4. **Dependency Vulnerability Audit**:
   ```sh
   npm --prefix frontend audit --audit-level=moderate
   pip-audit -r backend/requirements.txt
   ```
5. **CloudFormation / SAM Template Validation** (when IaC files change):
   ```sh
   sam validate -t infrastructure/cloudformation_serverless.yaml
   sam validate -t infrastructure/cloudfront_custom_domain.yaml
   ```
