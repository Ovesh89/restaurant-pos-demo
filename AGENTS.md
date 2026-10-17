# AGENTS.md — Restaurant POS MERN Migration

## 1. Mission and non-negotiable safety rules

This is the **new migration repository** for the Restaurant POS & KOT Management System.

- New working folder: `C:\GTS-POS\restaurant-pos-backend-mern`
- Read-only source backend: `C:\GTS-POS\restaurant-pos-backend`
- Read-only source Web app: `C:\GTS-POS\restaurant-pos-web`
- Read-only mobile app: `C:\GTS-POS\restaurant-pos-mobile`

**All code and documentation changes for this migration must be made inside `C:\GTS-POS\restaurant-pos-backend-mern` only.** Treat all three existing projects as read-only references. Never edit, format, rename, install packages into, reset, clean, commit, push, or otherwise modify the source backend, source Web app, or mobile project. Do not switch branches or change remotes in those projects. Do not delete, reset, clean, overwrite, or force-push any repository.

The React Native project must remain unchanged. Its current Captain and Kitchen API behavior is a compatibility requirement for the new backend.

If a requested step appears to require modifying a source project, stop and explain the blocker. Implement the migration inside the new repository, or ask for approval before taking any action outside it.

## 2. Goal and stack

Migrate the existing application to MERN:
- MongoDB — database
- Express.js — API framework
- React — existing Web frontend, copied/migrated into this repository
- Node.js — backend runtime

Use JavaScript unless an existing target convention or explicit user instruction requires otherwise. Use compatible, pinned dependency versions and commit lockfiles. Prefer the existing frontend framework/build setup (likely React/Vite) after inspection. Do not convert to TypeScript, upgrade major dependencies, or replace the UI framework without explicit approval and a documented reason.

This is a controlled migration of a working application, not a greenfield redesign. Preserve existing screens, styling, routes, operations and business behavior unless a documented defect requires a fix.

## 3. Read all docs before work

Before changing code:
1. Read this `AGENTS.md` completely.
2. Discover and read all project-owned Markdown files in the new repository, particularly everything inside `docs/`.
3. Read any requirement document the user places in `docs/`, including linked `.docx`/`.pdf` requirements if available to the workspace. Preserve the source terminology and business rules.
4. Inspect the source backend and source Web repository as read-only references.
5. Inspect the mobile project as a read-only API compatibility reference only.
6. Record which documents and source directories were actually inspected. Do not claim to have read inaccessible files.

Ignore generated/vendor directories such as `.git`, `node_modules`, build output, Python virtual environments, Gradle caches and generated artifacts. Do not silently reconcile conflicting requirements. Record material conflicts in `docs/MIGRATION_DECISIONS.md` and ask the user when a safe decision cannot be inferred.

## 4. First task: Phase 0 only

**The first Antigravity task is inspection and planning, not code migration.** Do not scaffold/overwrite the application before understanding the source projects.

Inspect:
- current state and Git status of the new repository
- source Django project, routes, services, serializers, auth, configuration and tests
- source React project, package/lock files, routes, page/components, stores, repositories, API client, local-storage adapter, printing, billing, tests and scripts
- mobile API client/repositories, auth, relevant Captain/Kitchen endpoints and configured API base URL (read-only; do not edit)
- actual API/OpenAPI documentation and running backend behavior where accessible

Create/update these documents **inside the new repository only**:
- `docs/SOURCE_PROJECT_INVENTORY.md`
- `docs/MIGRATION_PLAN.md`
- `docs/API_COMPATIBILITY_MATRIX.md`
- `docs/DATABASE_MIGRATION_PLAN.md`
- `docs/MIGRATION_DECISIONS.md` only when meaningful decisions/conflicts exist

Then STOP and report findings for review. No source application code changes in Phase 0.

## 5. Target repository structure

Use this as a starting point, adapting to actual needs:

```text
restaurant-pos-backend-mern/
├── AGENTS.md
├── docs/
├── apps/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── config/
│   │   │   ├── middleware/
│   │   │   ├── modules/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   ├── repositories/
│   │   │   ├── validators/
│   │   │   ├── utils/
│   │   │   ├── app.js
│   │   │   └── server.js
│   │   ├── tests/
│   │   ├── package.json
│   │   └── .env.example
│   └── web/
│       └── [migrated copy of existing React Web app]
├── scripts/
├── package.json (optional workspace)
├── .gitignore
└── README.md
```

Do not create empty/speculative modules without a reason. Keep backend and Web app separately runnable. The exact structure must be documented in `docs/MIGRATION_PLAN.md`.

## 6. Preserve the source Web app

Copy the existing Web source from `C:\GTS-POS\restaurant-pos-web` into `apps/web` in the new repository. **Copy, do not move.** Never write into the original source folder. Do not run formatters, refactors, dependency installers or generators in the source folder.

Preserve existing functionality and UX, including as applicable:
- authentication and role-aware navigation
- dashboard
- users, roles and permissions
- branches, areas and tables
- categories, products, availability and price history
- orders and order approval
- KOT and kitchen monitoring
- billing, discounts, taxes and rounding
- cash/UPI/card/other and split/mixed payments
- customers and history
- reports and audit log
- tax invoice/KOT printing
- loading, error, empty and responsive states

Do not replace working pages with placeholders or a generic dashboard. Do not claim a feature is migrated until it works and has been tested in the new copy.

## 7. Preserve API compatibility for unchanged Mobile

The new Express backend should reproduce the **observable API contract** of the existing Django backend so the existing Web and mobile clients can be tested without changing the mobile code.

Inspect the actual Django routes/source/OpenAPI and mobile API calls. Do not guess endpoints. For each endpoint record:
- path and API version
- HTTP method
- query parameters
- request body
- response JSON wrapper/fields
- ID formats and casing
- pagination/filter contract
- authentication and permissions
- error status and error payload
- client/features that use it
- implementation and test status

Preserve `/api/v1/` paths, request/response formats, role/permission representation, status strings, pagination, error codes and token semantics where current clients depend on them. If compatibility requires a change, document it and ask before introducing a breaking change.

Mobile compatibility areas include:
- login, refresh/logout, current user and permissions
- tables/areas
- categories/products
- order creation and item updates
- hold/resume/submit and status queries
- KOT queue/details and NEW/MODIFICATION/CANCELLATION representation
- kitchen PREPARING/READY transitions
- polling/notifications currently relied on by the mobile app

The mobile repository must remain untouched. Use API contract tests and, where available, run the existing mobile app as a black-box client without writing into its folder.

## 8. Runtime and database isolation

The current Django backend may run on port `8000`. Do not stop or reconfigure it. Run the new Express API on a separate development port (for example `8001`) while developing, using environment configuration.

Use a separate MongoDB development database by default, such as `restaurant_pos_mern_dev`. Do not connect to or write to the existing/production database by default. Never run destructive seed scripts, `dropDatabase`, collection drops or schema rewrites against an existing database. Do not migrate real data until there is a reviewed plan, backup, dry-run and rollback procedure.

Use `.env.example` with placeholders for `PORT`, `MONGODB_URI`, database name, JWT/token settings, CORS origins and logging. Never commit `.env`, credentials, access tokens or secrets. Do not copy secret values from the source projects.

For local inspection/contract tests, the existing backend at `http://127.0.0.1:8000/` is read-only. Compare the existing database schema/collection structure with any Mongoose models before defining or migrating collections. Similar database technology does not imply identical document shapes.

## 9. Backend design

Use a modular structure:

HTTP route → authentication middleware → permission middleware → validation → controller → service/domain logic → repository/data access → MongoDB → response mapper.

Keep controllers thin. Put business logic in services. Keep database queries in repositories. Use stable validation and error handling. Document the API with OpenAPI where practical.

Feature boundaries should cover the actual project scope, including:
- auth/identity, users, roles/permissions
- branches, areas, tables
- categories/products/price history
- orders and order events
- KOT and kitchen
- billing and payments
- customers
- reports
- audit and notifications
- settings/common health

Do not create one giant controller/service file. Do not implement future modules only speculatively.

## 10. Authentication and access control

Inspect the Django token implementation before selecting the Node strategy. Do not assume a new token payload, algorithm, secret or refresh behavior is compatible. Preserve current clients' expectations or document a safe migration strategy. If existing password hashes cannot be verified by Node, document a compatible verification or reset strategy; never silently reset passwords or weaken security.

Roles include Owner, Admin, Manager, Reception, Cashier, Captain and Kitchen. Use permission codes/central middleware; enforce authorization in Express, not only in the UI. Enforce branch scope server-side. Never return password hashes or sensitive configuration. Do not log passwords, access tokens, refresh tokens or secrets.

## 11. Critical business and data integrity rules

Preserve these rules in the new backend:
1. The server is authoritative for prices, tax, discounts, bill totals, order state, KOT numbers/revisions and payment balance.
2. Order items preserve captured product name, price and applicable tax snapshot; future menu price changes do not change historical orders/bills.
3. Bills preserve final item snapshots.
4. KOT, payment, cancellation, price history and audit history must not be silently overwritten/deleted.
5. Order and KOT state transitions must be validated server-side.
6. Cancellations require permission and reason where specified.
7. Discounts are permission-controlled and auditable.
8. Mixed payments are represented accurately; a bill cannot be completed with a balance due unless the current approved workflow explicitly supports partial payment.
9. Duplicate submit/confirm/KOT/bill/payment/close actions must be idempotent or safely rejected.
10. Completed orders must not be modified through ordinary edit endpoints.
11. Table state and active-order reference must be consistent after settlement.
12. Pending Settlement must exclude completed/paid/rejected/cancelled/voided records.
13. Printing is separate from settlement; printing must not create payments or change bill status.
14. Branch isolation is enforced.
15. Use exact decimal/money arithmetic and preserve current tax/rounding semantics.

Do not weaken a business rule to make the UI appear to work. Validate actual source behavior and requirements, and document conflicts.

## 12. Web data architecture

If the current Web app uses local repositories/localStorage, preserve them during migration where practical. Add an API-backed repository using the same business-facing contract, rather than changing each screen to call HTTP directly. Keep API field normalization inside the API repository/service boundary. Do not place URLs or `fetch`/Axios calls throughout components.

During development, keep local and API modes available if the source architecture supports them. Do not remove local mode until API-mode regression/UAT passes and cutover is approved. The Web should use the new Express backend only when explicitly configured to do so.

## 13. Recommended phases

Refine phase scope after inspection; do not skip Phase 0. Do not automatically progress from one phase to the next without verifying acceptance criteria.

### Phase 0 — Audit and plan (documentation only)
- Read all docs in new repo and source projects.
- Inspect current Django routes/API and existing Web behavior.
- Inspect Mobile API dependencies without modifying Mobile.
- Create source inventory, migration plan, API compatibility matrix and DB migration plan.
- Record gaps, risks and decisions.
- Stop for user review; no code changes.

### Phase 1 — MERN foundation
- Create new Express backend, environment configuration, safe MongoDB connection to separate dev DB, logging/error middleware, health/readiness and API contract tests.
- Copy existing React Web app into `apps/web` and prove it runs independently.
- Do not alter original projects.

### Phase 2 — Identity and master data
- Compatible auth/users/roles/permissions and branch context.
- Areas/tables, categories/products, availability and price history.
- Integrate corresponding Web modules against Express APIs.
- Verify endpoint contracts and branch permissions.

### Phase 3 — Orders, Reception, KOT and Kitchen
- Order lifecycle, item changes, hold/resume/submit, confirmation/rejection.
- KOT creation/revisions/cancellation and Kitchen queue/status actions.
- Preserve unchanged mobile API compatibility; test Captain/Kitchen contract.

### Phase 4 — Billing, payments and reports
- Bill calculation, tax/discount/rounding, payment and mixed payment, close/settlement, table release, recent settled invoices, customers, reports and audit.
- Preserve invoice/KOT printing and settlement/list refresh behaviors.

### Phase 5 — Regression and cutover readiness
- Web tests, backend/unit/API/contract tests and mobile compatibility tests without modifying Mobile.
- Auth/permissions, branch isolation, financial correctness, idempotency, performance and security checks.
- Backup/restore and dry-run migration only if data migration is approved.
- Deployment, rollback and cutover documentation.

Each phase needs explicit exit criteria and successful test results before proceeding.

## 14. Required testing

Test both successful and failing cases, including:
- auth, disabled user, 401/403, token expiry
- CRUD/validation/branch isolation
- category/product availability and price-history preservation
- order create/update/hold/resume/submit/confirm/reject
- KOT create/modify/cancel and PREPARING/READY transitions
- correct exclusion of completed/rejected/cancelled orders from pending settlement
- tax/discount/rounding and exact billing
- mixed payment and cannot-close-with-balance
- duplicate commands/idempotency
- table release after settlement
- invoice/KOT print regressions
- pagination, filters and error response contracts
- existing mobile Captain/Kitchen API flows

Do not declare a feature migrated only because the server starts or the code compiles. Run tests, lint, build and applicable end-to-end checks.

## 15. Git and safety

Before work, inspect Git status/branch/remotes **only inside the new repository**. Preserve existing uncommitted changes. Make commits or pushes only when explicitly requested. Never run Git mutation commands in source repositories.

`.gitignore` should cover `node_modules/`, build output, `.env`/secrets, logs, coverage, IDE and OS files. Commit `.env.example`, not `.env`.

## 16. Phase 0 deliverables

Create these documents in the new repository:
- `docs/SOURCE_PROJECT_INVENTORY.md`
- `docs/MIGRATION_PLAN.md`
- `docs/API_COMPATIBILITY_MATRIX.md`
- `docs/DATABASE_MIGRATION_PLAN.md`
- `docs/MIGRATION_DECISIONS.md` only if required

Report what was actually inspected, source feature status, verified API coverage, discrepancies, proposed target structure, database/auth risks, phase boundaries and decisions needing the user's input. Then stop and wait for approval.

## 17. Final instruction

Act as a senior MERN architect and migration engineer. Migrate working behavior, not just files. Keep source backend, source Web and mobile untouched. The new Express backend must preserve current API contracts so the existing Web/mobile clients can be tested without changing their source. Start with Phase 0: read documents, inspect the projects read-only, create the migration and compatibility plans, and stop for review before code migration.
