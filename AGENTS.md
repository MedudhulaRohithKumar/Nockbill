# Project Engineering, Security & Quality Rules

These rules are **always active** for every change in this repository. For the complete checklist and verification commands, read [SKILL.md](.agents/skills/code-quality-security-standards/SKILL.md).

## 1. Zero SonarQube / SonarCloud Issues
- Every change must introduce **0 Bugs, 0 Vulnerabilities, 0 Code Smells, and 0 unreviewed Security Hotspots**.
- **Frontend (TS/React)**: Use `Number.parseInt`/`Number.parseFloat`/`Number.isNaN`/`Number.isFinite` (`S7773`); associate every `<label>` with a control (`S6853`); avoid `autoFocus` (`S9379`); use native `<button type="button">` for interactive actions (`S6848`); pass compare functions to `.sort()` (`S2814`); avoid ReDoS regexes (`S8786`); never store auth tokens or secrets in `localStorage`/`sessionStorage` (`S8475`).
- **Backend (Python/FastAPI)**: Give every `Optional[T]` Pydantic field an explicit `= None` or `Field(default=None, ...)` default (`S8396`); extract repeated string literals (`S1192`); use `datetime.now(timezone.utc)` instead of `datetime.utcnow()`.
- **Docker, CI & IaC**: Pin base image versions and exact dependency versions (`==` / `npm ci --ignore-scripts`) (`docker:S8544`); run containers as non-root (`docker:S6585`); enforce `--proto "=https"` on `curl -L` (`githubactions:S6506`); pin GitHub Actions to commit SHAs; enable RDS `StorageEncrypted: true`, RDS `BackupRetentionPeriod >= 7`, S3 `LoggingConfiguration`, and CloudFront `Logging`.

## 2. Code Coverage Strictly > 90%
- Maintain **> 90% line and branch test coverage** across backend (`coverage.xml`) and frontend (`frontend/coverage/lcov.info`).
- Every new feature, endpoint, business rule, or bug fix must include automated unit/integration tests covering happy paths, validation errors, and edge cases.

## 3. Zero Trivy Issues & No Vulnerable Packages
- Codebase, dependencies, Dockerfiles, and CloudFormation templates must pass **Trivy** (`vuln`, `secret`, `misconfig`) with **0 MEDIUM/HIGH/CRITICAL issues**.
- Never introduce packages with known vulnerabilities, deprecated packages, or unpinned version ranges.
- Never commit secrets, tokens, or credentials.

## 4. Best System & API Design Principles
- **Multi-tenant isolation**: Scope all DB queries, mutations, and storage paths by authenticated `shop_id`.
- **Transactional integrity**: Use atomic DB transactions, `with_for_update()` row locking on stock/billing mutations, and `Decimal` for all currency/tax math.
- **API contracts**: Follow RESTful resource naming, proper HTTP status codes, strict Pydantic v2 input validation and sanitization, idempotency on financial writes, pagination on list endpoints, eager loading (`selectinload`) to avoid N+1 queries, RBAC enforcement, and audit logging.
- **Clean architecture**: Keep components, schemas, services, and routers modular with low cognitive complexity and backward-compatible additive schema migrations.
