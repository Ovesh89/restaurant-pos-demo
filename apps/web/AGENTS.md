# AGENTS.md
# Restaurant POS & KOT Management System
# React JS Web Application – Antigravity Project Rules

## 1. Project Identity

This repository is the React JS web application for the Restaurant POS & KOT Management System.

Repository:
- restaurant-pos-web

Related repositories:
- restaurant-pos-backend → Python + Django + REST API + MongoDB
- restaurant-pos-mobile → React Native Captain/Kitchen/monitoring application
- restaurant-pos-docs → Product, architecture, API and project documentation

The web application is responsible for:
- Owner/Admin
- Manager
- Reception
- Cashier
- Kitchen monitoring
- Restaurant configuration
- Menu management
- Table management
- Billing
- Payments
- Customers
- Reports
- Audit/activity monitoring

The current version MUST work without the Django backend.

Use localhost browser storage through the repository/service abstraction for the initial implementation.

Later, the local repository implementation will be replaced by REST API implementations backed by Django + MongoDB.

---

## 2. Primary Product Goal

Build a fast, reliable and modern Restaurant POS application.

The most important business workflow is:

Captain
→ Take Order
→ Submit Order
→ Reception Review
→ Reception Confirm
→ KOT Generated
→ Kitchen Receives KOT
→ Kitchen Prepares
→ Ready
→ Order Served
→ Final Bill
→ Payment
→ Completed
→ Table Available

The application is NOT a generic admin dashboard.

The UI must feel like a real restaurant operations application where speed, clarity and data integrity are more important than decorative UI.

---

## 3. Source of Truth

Use the project requirement specification available in:

docs/restaurant-pos-development-specification.md

or the equivalent specification file present in the repository.

Before starting a major task:

1. Read the relevant requirements.
2. Inspect the existing implementation.
3. Understand existing architecture.
4. Preserve working functionality.
5. Implement the smallest clean change that satisfies the requirement.
6. Test the resulting behavior.

Do not invent conflicting business rules.

When requirements are ambiguous, choose the simplest implementation compatible with:
- restaurant speed
- maintainability
- API integration
- auditability
- future expansion

---

## 4. Technology Rules

Use:
- React
- Vite
- JavaScript
- React Router
- Functional components
- React Hooks
- Zustand or Context for global state
- Tailwind CSS or the project's established styling solution
- Lucide React or the project's established icon library
- ESLint
- Prettier

Do not introduce TypeScript into this repository unless explicitly requested.

Do not add a large component/UI framework without a clear reason.

Prefer existing project dependencies over adding new dependencies.

Before adding a dependency:
1. Verify that an existing utility cannot solve the problem.
2. Keep the dependency small and focused.
3. Avoid duplicate libraries for the same purpose.

---

## 5. Architectural Principle

The application MUST separate:

UI
→ hooks/state
→ application services
→ repositories
→ storage/API adapter

Current implementation:

UI
→ hooks/state
→ services
→ local repositories
→ localStorage

Future implementation:

UI
→ hooks/state
→ services
→ API repositories
→ Django REST API
→ MongoDB

Components/pages MUST NOT directly call:
- localStorage
- fetch()
- axios
- REST endpoints
- browser persistence APIs

unless that code belongs inside the appropriate repository/service/adapter layer.

---

## 6. Repository / Data Access Rules

Use a repository abstraction.

Recommended structure:

src/
  services/
    repositories/
      authRepository.js
      userRepository.js
      roleRepository.js
      branchRepository.js
      categoryRepository.js
      productRepository.js
      tableRepository.js
      orderRepository.js
      kotRepository.js
      kitchenRepository.js
      billRepository.js
      paymentRepository.js
      customerRepository.js
      reportRepository.js
      auditRepository.js

  services/
    storage/
      localStorageAdapter.js

  services/
    calculations/
      billingCalculator.js

  services/
    printing/
      printService.js

The UI should depend on repository/service methods such as:
- login()
- getCurrentUser()
- getUsers()
- createUser()
- updateUser()
- getRoles()
- getProducts()
- getCategories()
- getTables()
- createOrder()
- updateOrder()
- submitOrder()
- confirmOrder()
- rejectOrder()
- holdOrder()
- resumeOrder()
- modifyOrder()
- cancelOrder()
- createKOT()
- updateKOTStatus()
- generateBill()
- addPayment()
- completeBill()
- getSalesReport()

Keep business logic out of page components.

---

## 7. Local Storage Rules

The initial application uses browser localStorage.

Do not scatter localStorage keys throughout the application.

Create a centralized adapter.

Use namespaced keys such as:
- restaurant_pos_users
- restaurant_pos_roles
- restaurant_pos_permissions
- restaurant_pos_branches
- restaurant_pos_areas
- restaurant_pos_tables
- restaurant_pos_categories
- restaurant_pos_products
- restaurant_pos_price_history
- restaurant_pos_orders
- restaurant_pos_order_events
- restaurant_pos_kots
- restaurant_pos_bills
- restaurant_pos_payments
- restaurant_pos_customers
- restaurant_pos_discounts
- restaurant_pos_cancellations
- restaurant_pos_audit_logs
- restaurant_pos_shifts
- restaurant_pos_settings
- restaurant_pos_notifications

Use a storage schema/version.

Example:
STORAGE_VERSION = 1

Provide migration support so future local schema changes can be handled.

Provide a development-only reset/seed mechanism.

Never delete operational history simply because an item/product/user becomes inactive.

Use active/inactive flags where appropriate.

---

## 8. API-Ready Requirement

The web application will later integrate with Django REST APIs.

Therefore:
- Keep repository method contracts stable.
- Do not couple UI to storage implementation.
- Do not expose MongoDB concepts in UI code.
- Do not put API URLs in components.
- Keep API base URL in configuration.
- Keep request/response mapping inside API repository/services.
- Keep authentication handling centralized.
- Version future API calls under /api/v1/.

The eventual switch should be conceptually:

LocalRepository
→ ApiRepository

without rewriting the feature pages.

---

## 9. Domain Boundaries

Use separate modules for:
1. Authentication
2. Users
3. Roles/Permissions
4. Branches
5. Areas/Tables
6. Menu/Categories/Products
7. Orders
8. KOT
9. Kitchen
10. Billing
11. Payments
12. Customers
13. Reports
14. Audit
15. Notifications
16. Settings

Do not combine unrelated modules into a single large service or page.

---

## 10. User Roles

Core roles:
- Owner
- Admin
- Manager
- Reception
- Cashier
- Captain
- Kitchen

Roles must be permission-driven.

Important permissions include:
- order.create
- order.submit
- order.confirm
- order.modify
- order.cancel
- kot.view
- kot.send
- kot.modify
- kot.cancel
- kitchen.update
- billing.generate
- billing.discount
- payment.collect
- bill.cancel
- menu.view
- menu.edit
- user.manage
- role.manage
- table.manage
- customer.view
- customer.edit
- report.view
- audit.view

Frontend permission checks are required.

IMPORTANT:
Frontend permission checks are only for user experience.
The future Django backend MUST enforce authorization server-side.

---

## 11. Authentication

Implement:
- Login
- Logout
- Current user
- Profile
- Change password
- Session persistence in local/demo mode
- Protected routes
- Role/permission guards

Demo credentials may be used locally only.

Never treat demo passwords as production security.

Do not expose secrets in source code.

---

## 12. Route Rules

Expected routes include:

/login
/dashboard
/tables
/orders
/reception
/kitchen
/billing
/customers
/menu/categories
/menu/products
/users
/roles
/reports/sales
/reports/items
/reports/captains
/reports/payments
/audit
/profile

Use protected routes.

Unauthorized users should receive an Access Denied state/page rather than seeing broken or partially accessible screens.

---

## 13. UI / UX Principles

This is a restaurant POS.

Prioritize:
- speed
- clarity
- touch friendliness
- high readability
- predictable navigation
- low cognitive load
- fast search
- clear status
- obvious primary actions

Do not create unnecessary confirmation dialogs.

Do not force operators through unnecessary pages.

Do not hide important operational state behind multiple clicks.

Use clear primary action hierarchy.

Avoid excessive animation.

Avoid decorative graphics that reduce usable space.

---

## 14. Captain / Order UX

Although the Captain application is primarily React Native, the React web application may need to support captain-like flows for testing or operational fallback.

The desired ordering flow is:

Table
→ Category
→ Item
→ Quantity
→ Review
→ Submit

Common actions must be easily available.

Use:
- product cards
- category tabs
- search
- quantity controls
- sticky action area
- readable totals

Do not use nested forms that slow order entry.

---

## 15. Order State Machine

Never allow arbitrary order status changes.

Use the defined lifecycle:

DRAFT / HOLD
→ SUBMITTED
→ WAITING_CONFIRMATION
→ CONFIRMED
→ KOT_SENT
→ PREPARING
→ READY
→ SERVED
→ BILLING
→ PAYMENT_PENDING
→ COMPLETED

Cancellation/void paths must be controlled.

Example:
SUBMITTED → CANCELLED
WAITING_CONFIRMATION → REJECTED
KOT_SENT → controlled modification/cancellation
PREPARING → controlled cancellation only
COMPLETED → no ordinary modification

Status transitions must be centralized in a business/domain service.

Do not manually mutate status from random components.

---

## 16. Order Item Price Rule

When an item is added to an order, capture:
- productId
- productName
- quantity
- unitPrice
- note

The captured unitPrice belongs to the order item.

Changing the menu price later MUST NOT change the price of an existing order.

This is critical for billing correctness.

---

## 17. KOT Rules

KOT is operational history.

Never silently overwrite or delete a KOT.

KOT types:
- NEW
- MODIFICATION
- CANCELLATION

Each KOT should contain:
- KOT number
- Order number
- Revision
- Table
- Captain
- Items
- Quantity
- Notes
- Time
- Status
- Print status

When an order changes after a KOT:
Create a delta/modification KOT.

Example:

Original:
Chicken Tikka x2

Modification:
+ Chicken Tikka x1

or:
- Chicken Tikka x1

or:
REMOVE Chicken Tikka

Preserve the original event.

---

## 18. Billing Rules

Do not calculate bill totals directly in page components.

Use:
src/services/calculations/billingCalculator.js

The calculation engine must determine:
- subtotal
- discount
- taxable value
- tax
- rounding
- grand total
- paid amount
- balance

The final bill must be calculated from the current canonical order state.

The UI must never be the source of truth for financial totals.

Use deterministic numeric calculations.

Do not rely on visually rounded numbers for internal calculation.

---

## 19. Discount Rules

Support:
- Percentage discount
- Fixed amount discount

Track:
- discount type
- entered value
- calculated amount
- reason
- user
- timestamp

Respect permission limits.

Every material discount action must create an audit event.

---

## 20. Payment Rules

Supported payment modes:
- Cash
- UPI
- Card
- Other

Support mixed payment.

Example:

Grand total ₹1500
UPI ₹1000
Cash ₹500
Paid = ₹1500
Balance = ₹0

Bill can be completed when balance reaches zero unless partial payment is explicitly implemented.

Store each payment separately.

Never overwrite previous payment history without an explicit correction/void mechanism.

---

## 21. Cancellation Rules

Cancellation of:
- item
- order
- bill

must be permission controlled.

Cancellation reason is mandatory.

Record:
- user
- reason
- date/time
- affected entity
- item/quantity where relevant

Never silently remove historical data.

---

## 22. Product/Menu Rules

Product fields may include:
- name
- code
- category
- price
- tax
- available
- kitchen station
- description
- image

Support:
- add
- edit
- activate
- deactivate

Do not physically delete historical product records that were already used by orders.

---

## 23. Price History

Whenever product price changes, store:
- productId
- oldPrice
- newPrice
- changedBy
- changedAt
- reason

The user must be able to view price history.

---

## 24. Table Rules

Statuses:
- AVAILABLE
- OCCUPIED
- KOT_SENT
- PREPARING
- READY
- BILL_PENDING
- PAID

Do not allow random manual status changes when a status should be derived from operational state.

The table should reference its current active order where applicable.

Future capabilities:
- transfer
- merge
- split

must be designed for, even if they are not enabled in the MVP.

---

## 25. Dashboard

The dashboard is role-aware.

Owner/Admin/Manager should be able to see:
- Today's Sales
- Today's Orders
- Today's Bills
- Open Tables
- KOT Pending
- Preparing
- Ready
- Pending Payments
- Cancelled Orders
- Discounts

Dashboard data must be calculated from actual repository data.

Do not hard-code dashboard numbers.

---

## 26. Reports

Core reports:
- Daily sales
- Monthly sales
- Item sales
- Captain sales
- Payment collection
- Discounts
- Cancellations
- Orders

Filters may include:
- date range
- branch
- captain
- table
- category
- product
- payment mode

Reports must operate on actual local data.

Do not use fake random values in final functionality.

---

## 27. Audit Log

Important actions must create audit events.

Examples:
- login
- order created
- order submitted
- order confirmed
- order rejected
- KOT created
- KOT modified
- item cancelled
- order cancelled
- discount applied
- bill generated
- payment recorded
- bill completed
- product price changed
- user changed
- permission changed

Audit records should include:
- actorId
- actorName
- action
- entityType
- entityId
- reason
- timestamp
- metadata

The UI should not expose deletion of audit records.

---

## 28. Printing

Implement a print abstraction.

Do not directly couple order/KOT/bill business logic to a printer SDK.

Use:
src/services/printing/printService.js

Support browser printing for localhost/demo mode.

Prepare print-ready formats for:
- KOT
- Invoice/Bill

KOT formatting should be suitable for thermal printer output.

Print failures should not lose the underlying KOT or bill data.

Track print status where practical:
- pending
- printed
- failed
- retrying

---

## 29. Notifications

Create a notification system for events such as:
- New order
- Order confirmed
- KOT sent
- KOT ready
- Bill pending
- Payment pending
- Cancellation
- Discount

For local mode:
- application events may simulate realtime behavior

For future backend integration:
- WebSocket/SSE can replace local event simulation

Do not tightly couple notification UI to transport technology.

---

## 30. React State Rules

Use centralized state only for cross-screen/shared application state.

Avoid putting every form input into global state.

Local component state is preferred for:
- temporary form input
- modal state
- dropdowns
- local UI state

Global/store state is appropriate for:
- authenticated user
- permissions
- active restaurant context
- active order context where genuinely shared
- notifications
- application-wide UI state

Do not duplicate the same source of truth across multiple stores.

Derived values such as order total should be calculated from canonical data.

---

## 31. Component Rules

Prefer small reusable components.

Common reusable components:
- Button
- Input
- Select
- SearchBox
- Modal
- Drawer
- DataTable
- StatusBadge
- PageHeader
- StatCard
- ConfirmDialog
- Toast
- EmptyState
- LoadingState
- ErrorState
- ProductCard
- TableCard
- OrderCard
- OrderItemRow
- KOTCard
- PaymentCard
- FilterBar

Do not create huge components.

Avoid files larger than approximately 500 lines where practical.

If a component becomes difficult to understand, split it by responsibility.

---

## 32. Styling Rules

Use one consistent design system.

Centralize:
- spacing
- typography
- border radius
- shadows
- status indicators
- button variants
- form styles
- card styles

Do not invent random CSS values for every screen.

Do not use inline styles for large styling systems.

Use responsive breakpoints consistently.

Ensure:
- good contrast
- visible focus states
- readable labels
- large touch targets
- useful hover/active states

---

## 33. Responsive Behavior

Primary targets:
1. Desktop admin
2. Tablet restaurant operations
3. Mobile-compatible fallback

Important screens:
- login
- dashboard
- tables
- reception
- kitchen
- billing
- menu
- customer search

The Captain workflow must remain fast on touch devices.

Never create horizontal scrolling for a normal page where it can be avoided.

Data tables may use controlled horizontal scrolling on very small screens when necessary.

---

## 34. Forms and Validation

Every form needs:
- required validation
- clear error messages
- disabled/loading submit state
- success feedback
- server/API-ready validation structure

Validate:
- required names
- numeric prices
- quantity > 0
- discount values
- payment amount
- cancellation reason
- rejection reason
- customer mobile
- unique usernames
- duplicate table numbers
- duplicate product codes where applicable

Do not rely only on browser validation.

Create reusable validation helpers where appropriate.

---

## 35. Error Handling

Every major data operation needs:
- loading
- success
- error

Handle:
- storage errors
- invalid state transitions
- duplicate data
- permission failures
- calculation errors
- printer errors
- malformed persisted data

Never silently swallow errors.

Do not display technical stack traces to restaurant operators.

Show actionable messages.

Log useful developer information in development mode.

---

## 36. Idempotency / Duplicate Protection

Design actions so accidental double-clicks do not create duplicate business events.

Examples:
- double Submit should not create two orders
- double Confirm should not create two KOTs
- double Generate Bill should not create duplicate bills
- double Payment should not create duplicate payments

Disable actions during processing.

Also use repository-level protections where possible.

---

## 37. Concurrency Awareness

Even in local mode, consider that multiple browser tabs or users may later update the same operational data.

Do not build assumptions that:
- one user always exists
- one order is never modified twice
- a screen's local state is always current

Repository operations should re-read canonical data before material state changes when needed.

Future Django implementation will become the definitive concurrency authority.

---

## 38. Seed Data

Create useful demo data:

Branches:
- Main Branch

Areas:
- Indoor
- Outdoor

Tables:
- Table 01 through Table 20

Categories:
- Starter
- Chicken
- Mutton
- Fish
- Rice
- Bread
- Drinks
- Dessert

Products should have realistic example prices and availability.

Create sample customers.

Create sample historical orders/KOTs/bills when useful for dashboard/report development.

Seed data must be deterministic.

Do not randomly change seed values on every reload.

---

## 39. Demo Users

Use local-only demo accounts such as:

Owner:
- username: owner
- password: owner123

Admin:
- username: admin
- password: admin123

Manager:
- username: manager
- password: manager123

Reception:
- username: reception
- password: reception123

Cashier:
- username: cashier
- password: cashier123

Captain:
- username: captain
- password: captain123

Kitchen:
- username: kitchen
- password: kitchen123

Clearly label these as DEMO/LOCAL accounts.

Do not use these credentials in production.

---

## 40. Demo / Developer Tools

Only in development mode, provide utilities such as:
- Reset demo data
- Seed demo data
- Generate sample orders
- Generate sample KOTs
- Generate sample bills
- Clear local notifications

Use confirmation for destructive actions.

Do not expose destructive developer controls in production builds.

---

## 41. File/Folder Conventions

Preferred structure:

src/
  app/
  assets/
  components/
  config/
  constants/
  hooks/
  layouts/
  pages/
  routes/
  services/
    repositories/
    storage/
    calculations/
    printing/
  stores/
  utils/
  validations/
  mock-data/
  styles/

Use feature-specific folders if that is cleaner once the project grows.

Do not move files for cosmetic reasons when there is no practical benefit.

---

## 42. Naming Rules

Use:
- PascalCase for React components
- camelCase for functions/variables
- descriptive repository names
- descriptive service names
- clear route names

Examples:
- OrderCard.jsx
- billingCalculator.js
- orderRepository.js
- useOrder.js

Avoid:
- data.js
- helper.js
- common.js

unless the file has a clearly defined responsibility.

---

## 43. Avoid Hard-Coded Business Logic

Do not hard-code:
- tax rates
- restaurant name
- branch
- table count
- discount limits
- invoice prefixes
- payment modes
- role assumptions

Put configurable values in settings/constants/configuration.

Where business logic truly needs fixed behavior, document it.

---

## 44. Security Rules

Even though the initial build is local:
- never store production credentials
- never commit .env
- use .env.example
- never expose secrets in frontend code
- never assume hidden UI = security
- centralize permission checks
- prepare for backend-enforced permissions later

Remember:
A React application cannot securely protect server-side business operations.
Django must enforce all important authorization once APIs are integrated.

---

## 45. Git Rules

Use small focused commits.

Recommended commit format:
- feat: add reception order confirmation
- feat: add KOT modification flow
- fix: prevent duplicate payment
- fix: preserve order item price
- refactor: extract billing calculator
- test: add order lifecycle tests

Do not commit:
- build output unless explicitly required
- .env
- secrets
- temporary screenshots
- local database dumps
- editor-specific temporary files

Branch examples:
- feature/order-workflow
- feature/kot-management
- feature/billing
- feature/user-management
- bugfix/payment-duplicate

---

## 46. Testing Requirements

At minimum, add tests for:
- login
- permission checks
- user CRUD
- product CRUD
- table lifecycle
- order creation
- order submit
- reception confirmation
- reception rejection
- hold/resume
- KOT generation
- KOT modification
- cancellation
- bill calculation
- discount calculation
- mixed payment
- bill completion
- table release
- audit creation

Critical E2E/browser flow:

Captain/Test User
→ Table 05
→ Chicken Tikka x2
→ Mutton Raan x1
→ Submit
→ Reception Confirm
→ KOT Created
→ Kitchen Preparing
→ Kitchen Ready
→ Generate Bill
→ UPI Payment
→ Complete
→ Table Available

---

## 47. Verification Loop

After making changes:

1. Run lint.
2. Run tests.
3. Run production build.
4. Start the local application if needed.
5. Open the affected route in the browser.
6. Verify the user flow.
7. Check browser console for errors.
8. Check for layout overflow.
9. Confirm persisted data after browser refresh.
10. Fix issues before moving on.

Do not declare a feature complete only because the code compiles.

---

## 48. Browser Verification

When working on UI:
- test desktop layout
- test tablet layout
- test mobile viewport
- test empty states
- test loading state
- test error state
- test long item names
- test large quantities
- test long customer/order lists
- test dialogs and drawers
- test keyboard navigation where relevant

For visual bugs, use browser screenshots/recordings when available.

---

## 49. Performance Rules

The POS should feel immediate.

Avoid:
- repeated localStorage reads in render
- unnecessary global state updates
- excessive rerenders
- giant lists without optimization
- large blocking calculations
- unnecessary animations
- duplicate repository calls

Menu browsing and table selection should remain responsive.

Do not add memoization everywhere; use it where profiling/reasoning shows value.

---

## 50. Accessibility

Use:
- semantic HTML
- accessible labels
- proper button elements
- keyboard navigation
- focus management for modals
- visible focus indicators
- sufficient contrast
- accessible status information

Icons should not be the only indication of important actions.

Important destructive actions need clear text.

---

## 51. Do Not Build Fake Functionality

Core MVP functionality must actually work.

Do not create a button that only:
- shows an alert
- changes a local visual state
- displays "Coming Soon"
- pretends to save data

A button marked as implemented must perform the real local repository operation.

Future functionality may be explicitly marked as:
- Roadmap
- Future release

Only when it is genuinely outside the current MVP.

---

## 52. MVP Scope

Prioritize these modules first:

### Phase 1
- Project setup
- Layout
- Authentication
- Users
- Roles
- Permissions
- Dashboard
- Categories
- Products
- Price History
- Tables
- Local Storage
- Seed Data

### Phase 2
- Orders
- Captain flow
- Hold/resume
- Reception confirmation
- Reception rejection
- KOT
- KOT modification
- Kitchen
- Notifications
- Audit

### Phase 3
- Billing
- Tax
- Discounts
- Payments
- Mixed payments
- Customers
- Reports

### Phase 4
- Printing refinement
- Responsive hardening
- Permission regression
- Error handling
- Performance
- Testing
- Production build
- Documentation

---

## 53. Features Outside Initial MVP

Do not accidentally expand scope without instruction.

Future modules include:
- advanced table transfer
- table merge
- split billing
- reservations
- advance booking
- inventory
- recipe management
- stock consumption
- low stock alerts
- suppliers
- purchase management
- multi-branch head office dashboard
- full offline mode
- online ordering
- delivery
- WhatsApp/SMS
- loyalty
- advanced analytics

Create architecture hooks where sensible, but do not implement them prematurely.

---

## 54. Architecture for Future Multi-Branch

Even if the first demo uses one branch, core domain objects should allow:

branchId

Do not design the application so that branch support later requires a rewrite.

Where appropriate include branch context in:
- users
- tables
- categories
- products
- orders
- KOTs
- bills
- payments
- reports
- audit logs

---

## 55. Documentation Rules

Maintain:
- README.md
- docs/architecture.md
- docs/data-model.md
- docs/order-workflow.md
- docs/local-development.md
- docs/api-integration-plan.md
- docs/permissions.md
- docs/testing.md

Update documentation when architecture changes.

Do not leave architecture decisions only inside chat history.

---

## 56. When Implementing a New Feature

Always follow this sequence:

1. Identify the business requirement.
2. Identify affected domain objects.
3. Identify repository/service changes.
4. Identify state/store changes.
5. Identify UI changes.
6. Add validation.
7. Add audit behavior if applicable.
8. Add tests.
9. Verify browser behavior.
10. Update documentation if needed.

Do not start with UI-only mockups when the feature requires real data behavior.

---

## 57. When Refactoring

Refactor only when useful.

Do not change working code merely for style preferences.

Before refactoring:
- understand current behavior
- identify tests
- preserve behavior
- make one logical change
- run regression tests

Do not mix large refactors with unrelated features.

---

## 58. When the User Gives a New Requirement

First determine whether it belongs to:
- current MVP
- a bug fix
- technical debt
- future roadmap

If it belongs to the current MVP:
implement it using the existing architecture.

If it is a larger new capability:
create the necessary architecture first and avoid hacks that block future API integration.

Do not silently expand scope.

---

## 59. Antigravity Execution Guidance

When asked to implement a feature:

1. Inspect the workspace.
2. Read AGENTS.md.
3. Inspect related code.
4. Create or update a concise implementation plan.
5. Implement in logical steps.
6. Run tests/build.
7. Verify in browser.
8. Fix issues.
9. Summarize the result.

For large tasks, work phase-by-phase rather than creating hundreds of unrelated files in one pass.

Prefer reversible, incremental changes.

---

## 60. Definition of Done

A feature is complete only when:
- requirement is implemented
- data is persisted correctly
- service/repository abstraction is used
- permissions are respected
- validation works
- error state works
- loading state works
- success feedback works
- audit event is added where required
- tests are added/updated
- lint passes
- build passes
- browser verification passes
- no critical console errors remain
- documentation is updated where necessary

---

## 61. Critical Business Integrity Rules

NEVER violate these rules:

1. Never silently change an existing order item's captured price.
2. Never silently delete KOT history.
3. Never silently delete cancellation history.
4. Never silently delete payment history.
5. Never allow unauthorized bill changes.
6. Never calculate final billing from arbitrary UI state.
7. Never allow duplicate bill creation from repeated clicks.
8. Never allow duplicate KOT creation from repeated confirmation.
9. Never mark a bill completed when an unpaid balance remains, unless partial payment is explicitly supported.
10. Never treat frontend hiding as server-side authorization.
11. Never hard-delete operational history that is needed for reporting/audit.
12. Never introduce business logic directly inside unrelated components.

---

## 62. Final Product Principles

The finished web application should be:
- Fast
- Simple
- Reliable
- Maintainable
- Modular
- Responsive
- API-ready
- Permission-aware
- Auditable
- Restaurant-friendly

Optimize the software for real-world restaurant operations.

The system should help staff complete tasks faster, not add unnecessary process.

---

## 63. Final Instruction

Act as a senior frontend architect, React engineer and restaurant POS product engineer.

Do not blindly generate code.

Understand the workflow first.

Preserve data integrity.

Prefer simple and maintainable solutions.

Use local repositories now.

Keep the architecture ready for Django REST APIs later.

Build real functionality, not visual placeholders.

When in doubt:
- protect existing business data
- preserve history
- centralize business rules
- keep UI fast
- keep the API boundary clean
- prefer the smallest maintainable solution
