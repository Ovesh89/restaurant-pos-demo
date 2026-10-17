**RESTAURANT POS  
& KOT MANAGEMENT SYSTEM**

Developer-Ready Product & Delivery Specification — MERN Stack Edition

**Target MVP delivery: 8 weeks \| 4 two-week phases**

**Technology baseline — MERN edition**

| **Layer**                  | **Technology**                                                                   |
|----------------------------|----------------------------------------------------------------------------------|
| Backend / API              | Node.js + Express.js + REST API                                                  |
| Database                   | MongoDB                                                                          |
| Web / Admin / Reception    | React JS                                                                         |
| Mobile / Captain / Kitchen | React Native                                                                     |
| Deployment                 | Cloud-hosted API + managed MongoDB; printer/local-device integration as required |

*Scope principle: build a fast dine-in + KOT + billing MVP first.
Inventory, multi-branch, offline synchronization, loyalty, online
ordering and advanced integrations remain controlled expansion modules.*

# 1. Executive Summary

This document translates the requested restaurant POS requirements into
a development specification that can be handed directly to the
development team. The immediate goal is a simple, fast restaurant
operations system centered on table orders, captain ordering, reception
confirmation, kitchen/KOT processing, completion, and final billing.

The proposed delivery model uses four two-week phases. Each phase ends
with a demonstrable increment, testing cycle, and acceptance checkpoint.
The 8-week plan is intentionally focused: the core restaurant workflow
is delivered first, while advanced modules are structured so they can be
added without rewriting the foundation.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Important delivery assumption</strong></p>
<p>The 8-week MVP assumes at least 2 developers (one backend/full-stack
and one React/React Native developer) plus QA/product coordination. A
single developer should not be expected to deliver the same scope with
the same quality inside 8 weeks.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 1.1 Product Objective

- Reduce captain order-taking time and eliminate handwritten KOT
  dependency.

- Create a controlled workflow from table order → reception confirmation
  → kitchen/KOT → preparation → ready/dispatch → billing/payment →
  closure.

- Keep every important change auditable: item add/remove, KOT
  modification, cancellation, discount, price change, payment change and
  bill cancellation.

- Make the UI fast enough for peak-hour restaurant use with minimal
  clicks/taps.

- Create a foundation for future multi-branch, inventory, offline mode,
  online ordering and loyalty modules.

## 1.2 Initial MVP in Scope

| **Module**     | **MVP scope**                                                             | **Priority** |
|----------------|---------------------------------------------------------------------------|--------------|
| Authentication | Login/logout, profile, password/PIN, role-based access                    | P0           |
| User & Roles   | Users, roles, permissions, branch/table access foundation                 | P0           |
| Menu           | Categories, products, prices, availability, item notes                    | P0           |
| Tables         | Table master, status, table selection, occupied/open flow                 | P0           |
| Captain Order  | Select table, add items, quantity, notes, submit                          | P0           |
| Reception      | Review submitted order, confirm/reject, manage changes                    | P0           |
| KOT / Kitchen  | Generate KOT, queue, preparation status, print-ready KOT                  | P0           |
| Order changes  | Add/remove/modify items before preparation; audit deltas                  | P0           |
| Billing        | Final calculation, taxes/discounts, bill/invoice generation               | P0           |
| Payment        | Cash/UPI/Card/Other, payment status and final close                       | P0           |
| Basic reports  | Daily sales, order count, item sales, payment collection, captain summary | P1           |
| Audit          | Important user actions with actor/date/time/reason                        | P1           |

## 1.3 Deliberately Deferred from the 8-Week MVP

- Full inventory/recipe/consumption automation and supplier purchase
  management.

- Full multi-branch head-office analytics and stock transfer.

- True offline-first transaction engine with automatic conflict
  resolution.

- Advanced reservations, loyalty, WhatsApp/SMS, online ordering,
  delivery and aggregator integrations.

- Complex accounting, e-invoicing/e-way-bill automation and
  hardware-specific integrations beyond the agreed printing path.

# 2. Reference Benchmark: Petpooja

Petpooja is used here as a functional benchmark, not as a copy target.
Its current public POS materials describe a fast billing flow with order
entry, bill punching and KOT generation, plus split/merge billing,
discounts, table/area management and station-wise KOT printing. Its
inventory materials also describe stock deduction, low-stock alerts and
purchase/supplier workflows. These capabilities are useful reference
points for future phases.

For the first release, the implementation should intentionally be
narrower than a mature all-in-one restaurant platform. The priority is
to reproduce the operational flow needed by this restaurant: captain
order entry, reception confirmation, kitchen KOT, preparation tracking
and final billing.

## 2.1 Benchmark Features to Keep in the Product Roadmap

| **Benchmark area**      | **Reference capability**                                | **Our planned treatment**                                   |
|-------------------------|---------------------------------------------------------|-------------------------------------------------------------|
| Fast billing/order flow | Quick order → KOT → billing workflow                    | Core MVP                                                    |
| Table management        | Table/area order control; merge/move/split capabilities | Basic table flow MVP; merge/move/split after core stability |
| Station KOT             | Route KOTs to specific cooking stations/printers        | Kitchen/KOT MVP; multi-station routing in next phase        |
| Discounts               | Percentage/fixed discount handling                      | MVP with permission control                                 |
| Inventory               | Auto deduction, low stock, supplier/purchase            | Post-MVP module                                             |
| Reports                 | Sales, staff actions, inventory and operational reports | Basic reports MVP; expanded reporting later                 |
| Offline                 | POS functions can operate offline                       | Architecture-ready; full sync later                         |
| Captain app             | Table-side ordering via mobile device                   | React Native captain module MVP                             |

*Benchmark source: Petpooja official public POS pages, reviewed 22
September 2026. Product capabilities can change over time; these pages
are used only as a functional benchmark.*

# 3. Technical Architecture

Recommended architecture: a modular Node.js + Express REST API serving
React web for admin/reception/cashier/management and the existing React
Native app for captain/kitchen workflows. MongoDB stores operational
documents and audit history. For the new MERN project, migrate/copy the
existing React Web application into the new repository and reimplement
the backend using Node.js and Express. Keep the existing Django backend,
original React Web repository, and React Native mobile project
unchanged. The new API must preserve the API contract required by the
unchanged mobile app. The API remains the single source of truth so web
and mobile cannot implement conflicting business rules.

## 3.1 Component View

| **Component**              | **Responsibility**                                                                                 |
|----------------------------|----------------------------------------------------------------------------------------------------|
| React Web                  | Admin, user/role management, menu, tables, reception, billing, reports, settings                   |
| React Native               | Captain ordering, table selection, order submission, order status, kitchen view where enabled      |
| Node.js + Express REST API | Authentication, permissions, order state machine, KOT generation, billing rules, reports, audit    |
| MongoDB                    | Users, roles, menu, tables, orders, KOT revisions, bills, payments, customers, audits              |
| Printer/Print Service      | KOT and invoice formatting and device printing                                                     |
| Realtime layer             | WebSocket/SSE or equivalent for new orders/status alerts; polling fallback for unreliable networks |
| Object/Cloud storage       | Optional storage for invoice PDFs, exports, backups or attachments                                 |

## 3.2 MongoDB + Node.js/Express Implementation Note

The MERN backend will use Node.js and Express for the versioned REST
API, with MongoDB as the database. During Phase 1, select and document
either the official MongoDB Node.js driver or Mongoose for data access
and schema validation. The selected approach must fit the current
document model and the API compatibility requirements for the existing
Web and React Native clients.

Therefore, Phase 1 must include a short technical spike before
committing to the Node.js/MongoDB data-access pattern. Pin compatible
Node.js, Express, MongoDB driver or Mongoose versions; validate
connection configuration, indexes, validation, unique constraints,
aggregation/reporting queries, ObjectId/string ID mapping,
transaction/session requirements, and migration behavior. Document the
supported approach. Multi-document transactions, if required, must be
tested against a MongoDB deployment that supports them.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Recommended engineering rule</strong></p>
<p>Keep business logic in Node.js/Express service/domain modules rather
than directly inside React screens or MongoDB queries. This makes the
system easier to extend to multi-branch, offline sync, inventory and
additional client apps.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 3.3 Suggested Backend Modules

- identity: authentication, users, roles, permissions, sessions/PIN.

- restaurant: branches, dining areas, tables, table status.

- menu: categories, products, price history, availability,
  modifiers/notes foundation.

- orders: order lifecycle, order items, item modifications, hold/resume.

- kot: KOT creation, revision/delta tickets, kitchen queue, preparation
  status and print payload.

- billing: final calculation, tax, discount, invoice numbering, bill
  lifecycle.

- payments: payment modes, split/mixed payments, settlement.

- customers: customer profile and order history foundation.

- reports: daily sales, item sales, captain sales, payment collection.

- audit: immutable operational events and reason codes.

- notifications/realtime: new order, KOT, ready, bill pending and
  alerts.

# 4. Roles & Permission Model

Permissions should be granular. Roles are bundles of permissions, and
the system should avoid hard-coding role names into every business rule.
This allows a future custom role without code changes.

| **Role**            | **Access**   | **Login/Profile** | **Order**     | **KOT**       | **Billing** | **Discount/Cancel** | **Reports**  |
|---------------------|--------------|-------------------|---------------|---------------|-------------|---------------------|--------------|
| Owner / Admin       | Full         | Yes               | Yes           | Yes           | Yes         | Yes                 | Yes          |
| Manager             | Management   | Yes               | Yes\*         | Yes\*         | Yes         | Limited             | Yes          |
| Reception / Cashier | Operations   | Yes               | Order/approve | Yes           | Yes         | Payment             | Limited      |
| Captain             | Order taking | Self              | No            | Own submitted | No          | No\*                | Own orders   |
| Kitchen             | KOT only     | Self              | No            | KOT status    | Yes         | No                  | Kitchen view |

*\* Exact permissions are configurable by Owner/Admin. Captain should
not edit final prices, delete orders, apply unrestricted discounts or
cancel finalized bills unless explicitly granted permission.*

## 4.1 Core Permission Codes

| **Permission**   | **Purpose**                                      |
|------------------|--------------------------------------------------|
| order.create     | Create/hold a table order                        |
| order.submit     | Submit order to reception                        |
| order.confirm    | Confirm/reject a submitted order                 |
| order.modify     | Add/remove/change items under permitted stage    |
| order.cancel     | Cancel order with mandatory reason               |
| kot.send         | Send/create KOT                                  |
| kot.modify       | Create modification KOT                          |
| kot.cancel       | Cancel KOT/item where stage allows               |
| kitchen.update   | Move KOT through kitchen status                  |
| billing.generate | Generate final bill                              |
| billing.discount | Apply discount within configured limit           |
| payment.collect  | Record payment                                   |
| bill.cancel      | Cancel finalized bill with permission and reason |
| menu.edit        | Create/edit price and availability               |
| report.view      | View operational reports                         |
| audit.view       | View activity logs                               |

# 5. Core Restaurant Workflow

## 5.1 End-to-End MVP Flow

1.  Captain logs in and selects an available/occupied table.

2.  Captain creates or resumes the table order and adds menu items,
    quantities and optional notes.

3.  Captain taps Submit. The order moves to WAITING_CONFIRMATION and
    becomes visible to Reception.

4.  Reception reviews the order and either Confirms or Rejects/returns
    it. Rejection must include a reason.

5.  On confirmation, the system creates a KOT revision/ticket and sends
    it to the kitchen queue/print service.

6.  Kitchen receives the KOT, moves it to PREPARING, then READY. The
    kitchen can see table, captain, item quantities, notes and time.

7.  Before preparation starts, permitted users can add/remove/change
    items. The system creates a KOT modification/delta record rather
    than deleting historical data.

8.  When items are prepared, kitchen marks READY. Service/captain
    receives the ready status.

9.  When the customer finishes, Reception/Cashier generates the final
    bill. The system calculates subtotal, eligible discount, taxes and
    final payable amount from the current canonical order.

10. Payment is captured as one or multiple payment entries. When the
    full amount is settled, the table becomes PAID/AVAILABLE and the
    order becomes COMPLETED.

11. All material actions are added to the audit trail with user,
    timestamp and reason where applicable.

## 5.2 Order State Machine

| **State**            | **Meaning**                                         | **Allowed next states**                       |
|----------------------|-----------------------------------------------------|-----------------------------------------------|
| DRAFT / HOLD         | Captain is building order or temporarily holding it | SUBMITTED, CANCELLED                          |
| SUBMITTED            | Captain has sent order to Reception                 | WAITING_CONFIRMATION, CANCELLED               |
| WAITING_CONFIRMATION | Reception review required                           | CONFIRMED, REJECTED, CANCELLED                |
| CONFIRMED            | Reception approved; KOT can be generated            | KOT_SENT, CANCELLED                           |
| KOT_SENT             | KOT issued to kitchen                               | PREPARING, MODIFIED, CANCELLED                |
| PREPARING            | Kitchen is preparing items                          | READY, MODIFIED, CANCELLED\*                  |
| READY                | Prepared items available for service                | SERVED, MODIFIED, CANCELLED\*                 |
| SERVED               | Food served; order awaits completion/billing        | BILLING, MODIFIED                             |
| BILLING              | Final bill generated/being settled                  | COMPLETED, PAYMENT_PENDING                    |
| PAYMENT_PENDING      | Bill exists; remaining amount unpaid                | COMPLETED, BILL_VOIDED                        |
| COMPLETED            | Order fully settled                                 | No ordinary edits; controlled correction only |
| CANCELLED / VOIDED   | Order is cancelled/voided                           | No ordinary edits                             |

*\* Once an item is already in preparation, cancellation/removal should
be permission-controlled and should create an explicit cancellation
record rather than silently deleting the item.*

## 5.3 KOT Modification Rules

- Never hard-delete a KOT or finalized KOT item.

- A modification KOT contains only the delta where possible: ADD +N,
  REDUCE -N, REMOVE, CHANGE NOTE, or CANCEL.

- The order document maintains the canonical current item state; KOT
  documents maintain the operational history sent to the kitchen.

- Every KOT revision stores revision number, reason, actor, timestamp
  and print/dispatch status.

- Final billing uses the current canonical order state, not a manually
  typed bill amount.

- If a price changes in Menu after an order is created, the order item
  retains its captured unit price so historical billing is stable and
  auditable.

# 6. Module-by-Module Requirements

## 6.1 Authentication & Profile

- Login/logout for web and mobile.

- Role-based access token/session.

- Password reset/change; optional PIN for quick restaurant-floor login.

- Profile: name, mobile, role, branch, active/inactive status.

- Session expiry and forced logout for disabled users.

- API must reject every unauthorized action server-side even if the UI
  hides the button.

## 6.2 User & Role Management

- Create, edit, activate/deactivate users.

- Create roles and assign permissions.

- Assign branch and optional allowed tables/areas where applicable.

- Maintain created/updated metadata.

- Prevent last active Owner/Admin from being disabled accidentally.

## 6.3 Product/Menu Management

- Category → product hierarchy.

- Product name, short name, code/SKU, price, tax category, availability,
  kitchen station and optional notes.

- Available/Unavailable toggle.

- Optional image field for future captain UI.

- Price change history: old price, new price, user, timestamp, reason.

## 6.4 Table Management

- Branch/area/table structure.

- Table number/name, capacity, status and active/inactive flag.

- Open table, occupied table, KOT sent, bill pending, paid/available.

- Foundation for transfer, merge and split orders; basic transfer can be
  enabled after core MVP stabilization.

## 6.5 Captain Ordering

- Fast table-first workflow.

- Category tabs + search + large touch targets.

- Quantity +/- controls and direct quantity entry.

- Item notes/special instructions.

- Off-menu item entry can be enabled with permission, with manual name
  and price captured.

- Save/Hold and Submit.

- Resume held order.

- View submitted/confirmed/preparing/ready status for the captain's
  active tables.

## 6.6 Reception / Order Confirmation

- Queue of WAITING_CONFIRMATION orders.

- Order details: table, captain, items, quantities, notes, submitted
  time.

- Confirm / Reject with reason.

- On confirm, KOT creation is automatic.

- Display modifications and cancellation alerts.

## 6.7 Kitchen / KOT

- Kitchen queue sorted by received time, with current age.

- KOT number, table, captain, item, quantity, notes and timestamps.

- Statuses: New, Accepted/Preparing, Ready, Cancelled.

- KOT print payload must be deterministic and readable.

- Separate station routing is a design hook; enable one kitchen station
  in MVP if hardware is limited.

## 6.8 Billing & Invoice

- Final bill generated only from current canonical order state.

- Subtotal, line discounts if later enabled, bill discount, tax,
  rounding and grand total.

- Restaurant header, table, bill number, order number, date/time, items,
  quantity, rate, tax/discount and payment information.

- Print/download/share-ready invoice representation.

- Bill number must be unique within the configured numbering scope.

## 6.9 Payments

- Cash, UPI, Card, Other.

- Split/mixed payment: multiple payment entries against one bill.

- Payment total must equal payable amount to close the bill (or explicit
  authorized partial-payment rule).

- Record collector, timestamp, mode, amount, reference/transaction
  number where applicable.

## 6.10 Customers

- Name, mobile, address and optional notes.

- Search by mobile/name.

- Link completed orders/bills to customer.

- Show visits, orders, total spending and last visit.

## 6.11 Discounts & Cancellations

- Percentage or fixed discount.

- Permission limits can be configured by role.

- Every discount requires actor; reason can be mandatory above
  configurable threshold.

- Item/order/bill cancellation requires reason and creates an audit
  record.

## 6.12 Basic Reports

- Daily sales summary.

- Bill/order counts.

- Item-wise quantity and sales amount.

- Payment-mode collection.

- Captain-wise orders/sales/tables served.

- Discounts and cancellations.

- Date filters and CSV/export foundation.

# 7. Suggested MongoDB Collections / Domain Model

The exact document model should be confirmed during the Phase 1
technical spike. The goal is to keep operational reads fast and avoid
excessive cross-collection joins. MongoDB guidance currently notes that
\$lookup can be less performant and recommends embedding where
appropriate.

| **Collection** | **Purpose**              | **Key fields / example structure**                                                            |
|----------------|--------------------------|-----------------------------------------------------------------------------------------------|
| users          | Login identity           | name, mobile, username, password hash, role_ids, branch_ids, status, last_login               |
| roles          | Role definitions         | name, permissions\[\], branch scope                                                           |
| permissions    | Optional master list     | code, name, module                                                                            |
| branches       | Restaurant branch        | name, code, address, tax settings, numbering settings, status                                 |
| areas          | Dining area              | branch_id, name, sort_order                                                                   |
| tables         | Dining table             | branch_id, area_id, table_no, capacity, status, active_order_id                               |
| categories     | Menu category            | branch_id, name, sort_order, active                                                           |
| products       | Menu item                | branch_id, category_id, name, code, price, tax, available, station_id                         |
| price_history  | Menu price audit         | product_id, old_price, new_price, changed_by, reason, changed_at                              |
| orders         | Canonical order          | order_no, branch_id, table_id, customer_id, captain_id, status, items\[\], totals, timestamps |
| order_events   | Order state history      | order_id, type, before, after, actor_id, reason, timestamp                                    |
| kots           | KOT revision/ticket      | kot_no, order_id, revision, type, items\[\], status, kitchen_station, print_status            |
| bills          | Final bill               | bill_no, order_id, items_snapshot\[\], totals, discount, tax, status, generated_by            |
| payments       | Payment entries          | bill_id, mode, amount, reference, collected_by, timestamp                                     |
| customers      | Customer CRM             | name, mobile, address, visit_count, last_visit_at, totals                                     |
| discounts      | Discount events          | bill_id/order_id, type, value, reason, actor_id                                               |
| cancellations  | Cancellation events      | entity_type, entity_id, item_id, quantity, reason, actor_id, timestamp                        |
| audit_logs     | Immutable activity log   | actor, action, entity, entity_id, payload, timestamp, branch_id                               |
| shifts         | Cashier shift            | user_id, branch_id, opening_cash, collections, expenses, closing_cash, status                 |
| settings       | Restaurant configuration | tax, invoice format, KOT format, numbering, permissions thresholds                            |

## 7.1 Order Item Snapshot Rule

Each order item should preserve product_id plus the item name and unit
price captured when the item is added. This prevents later menu edits
from changing the historical price of an open or completed order. The
canonical order holds current quantities/status; KOT revisions hold
operational deltas; the completed bill holds a final billing snapshot.

## 7.2 Indexing Priorities

- orders: branch_id + status + created_at; branch_id + table_id +
  status; branch_id + order_no.

- kots: branch_id + status + created_at; order_id + revision.

- bills: branch_id + bill_no; branch_id + generated_at; customer_id +
  generated_at.

- payments: bill_id; branch_id + payment_time + mode.

- customers: mobile; normalized_name where required.

- audit_logs: branch_id + timestamp; entity_type + entity_id +
  timestamp.

# 8. Application Screen Map

## 8.1 React Web

| **Area**       | **Screens**                                                     |
|----------------|-----------------------------------------------------------------|
| Auth           | Login, Change Password, Profile                                 |
| Dashboard      | Today sales, open orders, KOT queue, open tables, pending bills |
| Administration | Users, Roles, Permissions, Branches/Areas, Settings             |
| Menu           | Categories, Products, Price History                             |
| Tables         | Floor/table view, table detail, status                          |
| Reception      | Order approval queue, active orders, KOT view                   |
| Kitchen        | Kitchen queue, KOT detail, ready history                        |
| Billing        | Pending bills, bill detail, payment collection, bill print      |
| Customers      | Search, profile, order history                                  |
| Reports        | Sales, item, captain, payments, discount/cancel                 |
| Audit          | Activity log and filters                                        |

## 8.2 React Native

| **Screen**    | **Purpose**                                      |
|---------------|--------------------------------------------------|
| Login         | Captain/kitchen login                            |
| Home          | Assigned/current tables and alerts               |
| Tables        | Fast table status selection                      |
| Order         | Category/product selection, quantities, notes    |
| Review Order  | Confirm line items before submission             |
| Submit / Hold | Save or send order                               |
| Order Status  | See confirmation, KOT, preparing and ready state |
| Profile       | User details/logout                              |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>UX requirement</strong></p>
<p>Target a captain flow of: Login → Table → Category → Item → Quantity
→ Submit. Avoid nested forms, unnecessary confirmations and screens that
force the captain to leave the table context.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# 9. API Design Baseline

Use versioned REST endpoints, for example /api/v1/. Responses should be
consistent and should include a machine-readable error code so
mobile/web clients can handle failures without parsing messages.

| **Method** | **Endpoint**         | **Purpose**                      |
|------------|----------------------|----------------------------------|
| POST       | /auth/login          | Authenticate user                |
| POST       | /auth/logout         | Logout/revoke session            |
| GET        | /me                  | Current user/profile/permissions |
| GET/POST   | /users               | User management                  |
| GET/POST   | /roles               | Role management                  |
| GET/POST   | /menu/categories     | Category CRUD                    |
| GET/POST   | /menu/products       | Product CRUD                     |
| GET        | /tables              | Table status                     |
| POST       | /orders              | Create order                     |
| POST       | /orders/{id}/submit  | Submit to reception              |
| POST       | /orders/{id}/confirm | Reception confirmation           |
| POST       | /orders/{id}/reject  | Reject with reason               |
| POST       | /orders/{id}/items   | Add items / modification         |
| POST       | /orders/{id}/hold    | Hold order                       |
| POST       | /orders/{id}/resume  | Resume order                     |
| POST       | /orders/{id}/cancel  | Cancel order                     |
| GET        | /kots                | Kitchen queue                    |
| POST       | /kots/{id}/status    | Kitchen status change            |
| POST       | /orders/{id}/bill    | Generate final bill              |
| POST       | /bills/{id}/payments | Record payment                   |
| POST       | /bills/{id}/close    | Close/complete bill              |
| GET        | /reports/daily-sales | Daily sales                      |
| GET        | /reports/item-sales  | Item sales                       |
| GET        | /reports/captains    | Captain report                   |
| GET        | /audit               | Audit log                        |

# 10. Business Rules & Financial Logic

| **Rule**           | **Implementation requirement**                                                                                                         |
|--------------------|----------------------------------------------------------------------------------------------------------------------------------------|
| Final calculation  | Bill amount is calculated from the current order state when billing is generated/closed, not from a manually maintained captain total. |
| Price snapshot     | Order item stores captured selling price. Later menu price changes do not alter that order.                                            |
| Tax                | Tax configuration must be versionable by branch/service context; final tax is calculated from the billable item snapshot.              |
| Discount           | Percentage or fixed amount; cannot exceed permitted base unless explicitly configured.                                                 |
| Rounding           | One centrally configured rounding rule; calculation engine must be deterministic.                                                      |
| Mixed payment      | Sum of payment entries must equal payable amount before completion, except authorized partial-payment states.                          |
| Cancellation       | Reason mandatory; actor/timestamp recorded; no silent deletion.                                                                        |
| Completed order    | No ordinary edits. Corrections use controlled void/refund/adjustment events.                                                           |
| Table availability | Table becomes available only after bill settlement/closure according to configured restaurant process.                                 |
| Invoice numbering  | Unique bill number generated server-side; never trust a number supplied by the client.                                                 |

## 10.1 Example Final Bill Calculation

| **Line**        | **Formula / Example**                                   |
|-----------------|---------------------------------------------------------|
| Food subtotal   | Sum(order_item.quantity × captured_unit_price)          |
| Gross discount  | Fixed amount OR percentage of configured bill base      |
| Taxable value   | Subtotal − applicable discount                          |
| Tax             | Taxable value × configured tax rate(s)                  |
| Rounding        | Configured rounding adjustment                          |
| Grand total     | Taxable value + tax + rounding                          |
| Paid            | Cash + UPI + Card + Other                               |
| Balance         | Grand total − paid                                      |
| Close condition | Balance = 0 (unless partial payment explicitly allowed) |

# 11. 8-Week Delivery Plan

The schedule below is designed around four two-week phases. Each phase
includes development plus QA/UAT. Work should be demonstrated at the end
of each week rather than waiting until the end of the phase.

| **Week** | **Phase**            | **Primary deliverables**                                                                                                                                                                                                 | **Exit criteria**                                                                                                                                 |
|----------|----------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------|
| 1        | Phase 1 - Foundation | Repo/setup, Node.js + Express API skeleton, MongoDB connectivity, auth/user-role/permission foundation; copy existing React Web into the new repository; verify mobile API compatibility without modifying mobile source | Login and initial user/role CRUD work; API contract tests are in place; MongoDB data-access approach approved; original projects remain unchanged |
| 2        | Phase 1 - Foundation | Menu/category/product CRUD, price history, table/area master, basic dashboard shell, base audit framework                                                                                                                | Admin can create users/menu/tables; permissions enforced; Phase 1 demo accepted                                                                   |
| 3        | Phase 2 - Order      | Captain login, table selection, cart/order UI, hold/resume, submit flow, reception queue                                                                                                                                 | Captain can create/submit orders; Reception can see them                                                                                          |
| 4        | Phase 2 - Order      | Reception confirm/reject, KOT generation, kitchen queue, KOT print payload, order/KOT status flow, add/remove/modify item delta                                                                                          | Order moves end-to-end to kitchen; KOT history preserved; Phase 2 demo accepted                                                                   |
| 5        | Phase 3 - Billing    | Final bill calculation, discount, tax configuration, invoice UI/template, payment modes                                                                                                                                  | Bill calculation verified against test cases; cash/UPI/card work                                                                                  |
| 6        | Phase 3 - Billing    | Mixed payment, bill close, customer linking, basic reports, captain-wise and item-wise sales                                                                                                                             | Completed order is paid and reported; Phase 3 UAT accepted                                                                                        |
| 7        | Phase 4 - Hardening  | Audit refinement, cancellation/void controls, table status refinement, printer integration/fallback, responsive UI, error handling, monitoring/logging                                                                   | Critical workflows stable in staging; high-priority defects closed                                                                                |
| 8        | Phase 4 - Release    | Regression, security/permission test, performance smoke test, deployment, DB backup, documentation, production checklist, user training/UAT                                                                              | Release candidate approved; production deployment checklist complete                                                                              |

## 11.1 Phase Deliverables in More Detail

### Phase 1 (Weeks 1-2): Foundation & Admin

- Set up the new MERN repository with clearly separated backend and Web
  application folders; keep the existing source repositories untouched.

- CI checks: lint, type checks where applicable, automated tests.

- Node.js + Express REST API base, environment-specific configuration,
  secrets from environment variables.

- MongoDB connection and data-access proof-of-concept using the selected
  Node.js driver/Mongoose approach.

- Authentication, roles, permissions and user management.

- Menu/category/product and table/area administration.

- Initial audit logging.

### Phase 2 (Weeks 3-4): Captain → Reception → Kitchen

- Support the existing Captain-first React Native workflow through
  compatible APIs; do not modify the mobile source project.

- Table-scoped order lifecycle.

- Reception approval workflow.

- KOT creation and kitchen queue.

- KOT print format and print service interface.

- Modification KOT / cancellation event model.

### Phase 3 (Weeks 5-6): Billing & Reports

- Final calculation engine.

- Discount and tax handling.

- Invoice/bill generation.

- Cash/UPI/Card/Other and mixed payments.

- Customer profile/history foundation.

- Basic item, captain and payment reports.

### Phase 4 (Weeks 7-8): Hardening & Production

- Security and permission regression.

- Audit completeness and correction flows.

- Printer/network failure handling.

- Responsive/resolution testing.

- Performance smoke tests for peak-hour workflows.

- Deployment, monitoring, backup and training.

# 12. Post-MVP Roadmap (Weeks 9+)

| **Stage**   | **Module**         | **Major functionality**                                                              | **Suggested duration** |
|-------------|--------------------|--------------------------------------------------------------------------------------|------------------------|
| Release 1.1 | Table advanced     | Transfer, merge, split table/bill, reservations/advance booking                      | 1-2 weeks              |
| Release 1.2 | CRM                | Customer history, repeat visit analysis, basic loyalty hooks                         | 1 week                 |
| Release 1.3 | Inventory          | Raw material master, recipe mapping, auto consumption, low-stock alerts              | 3-4 weeks              |
| Release 1.4 | Purchase/Supplier  | Suppliers, purchases, outstanding, stock receiving                                   | 2-3 weeks              |
| Release 1.5 | Multi-Branch       | Branch-level access, consolidated dashboard, branch reporting, numbering/tax configs | 2-3 weeks              |
| Release 1.6 | Offline            | Local queue, retry, conflict resolution, sync state and reconciliation               | 3-5 weeks              |
| Release 1.7 | Online/Delivery    | Website/app orders, aggregator connectors, delivery workflow                         | 3-6 weeks              |
| Release 1.8 | Advanced analytics | Shift analytics, food cost, gross margin, deep operational reports                   | 2-4 weeks              |
| Release 1.9 | Messaging/loyalty  | WhatsApp/SMS receipts, loyalty, offers, customer campaigns                           | 2-4 weeks              |

*Durations are indicative and depend heavily on hardware, tax/accounting
requirements, third-party integrations and offline synchronization
design.*

# 13. Non-Functional Requirements

| **Area**           | **Requirement**                                                                                                    |
|--------------------|--------------------------------------------------------------------------------------------------------------------|
| Performance        | Captain's common order actions should feel near-instant on normal LAN/Wi-Fi; avoid unnecessary blocking API calls. |
| Availability       | Core API should be monitored; failure should show actionable UI messages rather than generic errors.               |
| Security           | HTTPS, secure password hashing, token/session security, server-side authorization, rate limits on auth endpoints.  |
| Audit              | Important operations immutable/auditable; users must not edit or delete audit records through normal UI.           |
| Data retention     | Minimum 1 year of operational data; design for long-term cloud retention.                                          |
| Backup             | Automated daily database backups with tested restore process.                                                      |
| Observability      | Centralized application logs, error monitoring, request correlation IDs, key business metrics.                     |
| Scalability        | Branch_id and tenant/branch scope should exist in core documents even when starting with one branch.               |
| Responsive UI      | Web admin/reception usable on desktop and tablet; captain/kitchen optimized for touch.                             |
| Printer resilience | Print failures must not lose the KOT; print_status and retry state required.                                       |
| API versioning     | Version APIs (/v1) so mobile releases can be staggered.                                                            |
| Testing            | Unit tests for financial/state rules; API tests for permissions; end-to-end tests for captain→KOT→bill flow.       |

# 14. QA & Acceptance Strategy

## 14.1 Critical Test Scenarios

- Captain creates order for Table 05, submits, Reception confirms, KOT
  appears in Kitchen.

- Reception rejects an order; captain sees rejection reason and can
  correct/resubmit.

- Add 2 quantities after initial KOT; modification KOT contains +2 and
  final bill contains the new quantity.

- Remove an item before preparation; cancellation/removal is visible in
  KOT history and final bill excludes the item.

- Change menu price after an order is open; existing order item uses its
  captured price.

- Apply fixed and percentage discounts; verify permission limits and
  audit record.

- Split payment: ₹1,500 bill = ₹1,000 UPI + ₹500 Cash; bill closes only
  after full settlement.

- Attempt unauthorized captain action through the API (price edit, bill
  cancellation, unrestricted discount); API returns authorization
  failure.

- Kitchen marks KOT ready; captain/reception sees updated state without
  manual refresh where realtime is enabled.

- Printer becomes unavailable; KOT stays stored and can be retried
  without duplicate order creation.

- Two users update the same order; server rejects stale/invalid
  transitions rather than silently overwriting data.

- Completed bill cannot be modified through ordinary order edit
  endpoints.

## 14.2 Definition of Done

- Functional requirements for the story are implemented and reviewed.

- API validation and permission checks are server-side.

- Unit/API tests added for important business logic.

- UI has empty/loading/error/success states.

- Audit log captured for applicable actions.

- No critical/high-priority defects open for the phase.

- Feature demonstrated to the product owner and accepted.

- Documentation/API examples updated.

# 15. Environment & Deployment Plan

| **Environment** | **Purpose**                     | **Minimum expectation**                                                             |
|-----------------|---------------------------------|-------------------------------------------------------------------------------------|
| Local           | Developer machines              | Docker/Node.js/npm setup, seeded test data, local MongoDB or development cluster    |
| Development     | Shared integration              | Hosted API + test DB, CI deployment                                                 |
| Staging/UAT     | Owner/reception/captain testing | Production-like configuration, printer test, backup test                            |
| Production      | Live restaurant                 | HTTPS, managed MongoDB, backups, logs/monitoring, secrets, deployment rollback plan |

## 15.1 Suggested Release Checklist

1\. Create production database with restricted credentials.

2\. Configure environment secrets; never commit credentials.

3\. Enable HTTPS and secure cookie/token settings.

4\. Create indexes and validate query plans for high-use screens.

5\. Run backup and restore test.

6\. Create first Owner/Admin account.

7\. Load branch/area/table/menu master data.

8\. Configure tax, invoice numbering and KOT printer details.

9\. Run a full test order using a real printer/device.

10\. Train Reception/Cashier, Captain and Kitchen.

11\. Monitor first production shift and record defects/operational
feedback.

# 16. Working Agreement for Development Team

To keep the two-month plan realistic, scope changes should be
controlled. New functionality should enter a backlog rather than being
added to a nearly completed phase without an explicit trade-off.

| **Cadence**      | **Expected activity**                                                              |
|------------------|------------------------------------------------------------------------------------|
| Daily            | Developer sync on blockers; commit small changes; CI must remain green.            |
| End of week      | Demo completed user flows; record defects and next-week priorities.                |
| End of phase     | Formal UAT checkpoint; acceptance/rejection documented.                            |
| Change request   | Describe requirement, impact, effort and what moves out if the date remains fixed. |
| Production issue | Prioritize order/billing/KOT data integrity above cosmetic changes.                |

# 17. Phase Acceptance Checkpoints

| **Phase** | **Owner should be able to demonstrate**                                                                                                                                     |
|-----------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Phase 1   | Login with role restrictions; create user/role; create categories/products; change price; create areas/tables; see table master.                                            |
| Phase 2   | Captain logs in → selects table → adds items → submits → Reception confirms → KOT is generated → Kitchen sees/prints → item changes produce KOT history.                    |
| Phase 3   | Ready order → generate final bill → apply discount/tax → accept Cash/UPI/Card or mixed payment → close bill → table becomes available → sales reports update.               |
| Phase 4   | Critical end-to-end flow passes regression; permissions are verified; cancellations/discounts audited; backups and deployment are validated; production checklist complete. |

# 18. Decisions to Finalize Before Development Starts

The team should not block the entire project on every advanced
requirement. The following decisions are specifically important for
Phase 1 because they affect architecture or financial correctness.

| **Decision**                                      | **Recommended Phase-1 default**                                                                                                                                                                      |
|---------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Single branch or multi-branch data model?         | Build branch_id into core documents from day one, even if only one branch is active.                                                                                                                 |
| Node.js + Express + MongoDB data-access approach? | Choose the official MongoDB Node.js driver or Mongoose during Phase 1; pin compatible versions and validate indexes, validation, aggregation, transactions and migration behavior before production. |
| Realtime transport?                               | WebSocket/SSE preferred for kitchen/alerts, with polling fallback.                                                                                                                                   |
| Printing approach?                                | Abstract print service; keep KOT/invoice payload independent from the printer vendor.                                                                                                                |
| Tax/GST rules?                                    | Make configurable; exact tax treatment to be confirmed by the restaurant/accounting owner.                                                                                                           |
| Bill numbering?                                   | Server-side sequence scoped to branch/date or configured series.                                                                                                                                     |
| Offline MVP?                                      | Do not promise true offline billing in the first 8 weeks; build retry/idempotency foundations only.                                                                                                  |
| Off-menu pricing?                                 | Enable only for authorized users and always capture name + entered price + actor.                                                                                                                    |

# 19. Final Delivery Statement

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>8-week MVP target</strong></p>
<p>At the end of Week 8, the application should support the complete
basic dine-in flow: Admin manages users/roles/menu/tables → Captain
takes the table order → Reception confirms → KOT reaches Kitchen/prints
→ Kitchen prepares and marks ready → permitted users can modify/cancel
with audit history → final bill is generated → payment is recorded →
order/table is completed and basic reports are available.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

The complete requirement list should be treated as the product roadmap,
not as a commitment that every advanced module belongs in the 8-week
MVP. This separation protects the delivery date while preserving the
architecture for multi-branch, inventory, offline, procurement,
reservations, customer loyalty, online ordering and advanced analytics.

The product should optimize for restaurant speed: table-first
navigation, minimal captain taps, clear confirmation states, fast KOT
dispatch, resilient printing, and a billing screen that requires as few
steps as practical.

# 20. References

Current public reference pages consulted for benchmark/technology
verification:

- Petpooja – Restaurant POS and Management System:
  https://www.petpooja.com/poss

- Petpooja – Restaurant Billing Software:
  https://www.petpooja.com/poss/restaurant-billing-software

- Petpooja – Restaurant Inventory Management Software:
  https://www.petpooja.com/poss/restaurant-inventory-management-software

- Petpooja – Fine-Dine Restaurant POS Software:
  https://www.petpooja.com/poss/fine-dine-restaurant-pos-software

- Node.js – Official Documentation: https://nodejs.org/docs/latest/api/
  and Express – Official Documentation: https://expressjs.com/

- MongoDB – Node.js Driver:
  https://www.mongodb.com/docs/drivers/node/current/ and Mongoose –
  Official Documentation: https://mongoosejs.com/docs/

*Document prepared as a developer-facing planning specification. Dates,
durations and module boundaries are estimates and should be re-estimated
after the Phase 1 technical spike and confirmation of
printer/tax/payment requirements.*
