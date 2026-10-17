# Restaurant POS & KOT Management System – Web

React JS web application for the Restaurant POS & KOT Management System.

This application provides the web interface for restaurant administration and operations, including:

- Owner / Admin
- Manager
- Reception
- Cashier
- Kitchen monitoring
- Menu management
- Table management
- Billing and payments
- Customer management
- Reports
- Audit/activity monitoring

The mobile application is maintained separately in `restaurant-pos-mobile`, and the backend/API is maintained separately in `restaurant-pos-backend`.

## Project Architecture

### Current / Development

```text
React UI
   ↓
Hooks / State
   ↓
Repository / Service
   ↓
Local Storage
```

### Target / API

```text
React UI
   ↓
Hooks / State
   ↓
Repository / Service
   ↓
API Client
   ↓
Django REST API
   ↓
MongoDB
```

The UI should not need to be rewritten when switching from local data to API data.

## Related Repositories

### Backend

https://github.com/Ovesh89/restaurant-pos-backend

Technology:
- Python
- Django
- Django REST Framework
- MongoDB

### Mobile

Repository:
`restaurant-pos-mobile`

Technology:
- React Native
- Android

Mobile scope:
- Captain
- Kitchen

## Technology Stack

- React
- Vite
- JavaScript
- React Router
- Zustand or the approved state-management solution
- Tailwind CSS or the approved styling solution
- Lucide React / approved icon library
- ESLint
- Prettier

The exact installed versions are defined in `package.json`.

## Main Web Modules

### Authentication
- Login
- Logout
- Session restoration
- Profile
- Change password
- Role/permission handling

### Administration
- Users
- Roles
- Permissions
- Branches
- Areas
- Settings

### Menu
- Categories
- Products
- Product availability
- Price changes
- Price history

### Restaurant Operations
- Tables
- Orders
- Reception confirmation
- KOT
- Kitchen monitoring
- Order status

### Billing
- Bill generation
- Discounts
- Tax
- Payments
- Mixed payments
- Bill completion

### Customers
- Customer search
- Customer profile
- Order history
- Visit/spending summary

### Reports
- Daily sales
- Item sales
- Captain sales
- Payment collection
- Discounts
- Cancellations
- Order reports

### Audit
- User activity
- Order actions
- KOT actions
- Discounts
- Cancellations
- Billing/payment activity
- Price changes

## Core Restaurant Workflow

```text
Captain
   ↓
Take Order
   ↓
Submit Order
   ↓
Reception Review
   ↓
Reception Confirm
   ↓
KOT Generated
   ↓
Kitchen
   ↓
Preparing
   ↓
Ready
   ↓
Served
   ↓
Final Bill
   ↓
Payment
   ↓
Completed
   ↓
Table Available
```

The backend is the authoritative business layer for order state, pricing, tax, billing, payment and other business-critical operations.

## Local Development

### Prerequisites

Install:
- Node.js
- npm

Verify:

```bash
node --version
npm --version
```

### Installation

```bash
git clone https://github.com/Ovesh89/restaurant-pos-web.git
cd restaurant-pos-web
npm install
```

Create the local environment file from `.env.example`.

Do not commit `.env`.

### Environment Configuration

Example local mode:

```env
VITE_DATA_PROVIDER=local
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

API mode:

```env
VITE_DATA_PROVIDER=api
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

The exact environment variables used by the implementation should remain documented in `.env.example`.

Never commit secrets or production credentials.

### Start the Application

```bash
npm run dev
```

Vite commonly serves the app at:

```text
http://localhost:5173
```

### Production Build

```bash
npm run build
npm run preview
```

## Testing and Quality Checks

Run the available checks before committing:

```bash
npm run lint
```

If tests are configured:

```bash
npm test
```

Always verify the application in the browser after major feature changes.

## Repository / Service Architecture

Pages and components should not directly access:

- `localStorage`
- `fetch`
- `axios`
- backend URLs

Those responsibilities belong in the service/repository layer.

Recommended concept:

```text
src/
├── api/
├── components/
├── hooks/
├── layouts/
├── pages/
├── routes/
├── stores/
├── services/
│   ├── repositories/
│   │   ├── local/
│   │   └── api/
│   ├── calculations/
│   ├── printing/
│   └── storage/
├── utils/
└── validations/
```

## API Integration

Development backend:

```text
http://localhost:8000/api/v1
```

Example repository usage:

```javascript
orderRepository.submitOrder(orderId)
```

The calling page should not need to know whether the repository uses local storage or Django REST API.

## Important Business Rules

1. Existing order item prices must remain unchanged when menu price changes.
2. KOT history must be preserved.
3. Cancellation requires a reason where the workflow requires it.
4. Final bill calculation is backend-authoritative in API mode.
5. Payment history must not be silently overwritten.
6. Completed orders must not be edited through ordinary flows.
7. Duplicate submit/confirm/payment actions must be protected.
8. Frontend permissions do not replace backend authorization.

See `AGENTS.md` and `docs/` for the detailed engineering and business requirements.

## Branch Strategy

Recommended:

```text
main
develop
feature/*
bugfix/*
release/*
hotfix/*
```

Typical workflow:

```text
develop
   ↓
feature/feature-name
   ↓
development + testing
   ↓
Pull Request
   ↓
develop
   ↓
UAT
   ↓
main
```

Do not normally commit feature work directly to `main`.

## Commit Conventions

Examples:

```text
feat: add django api client
feat: integrate product api
feat: integrate table api
feat: integrate order api
feat: integrate kot api
feat: integrate billing api
fix: handle token refresh
fix: prevent duplicate payment
refactor: separate local and api repositories
test: add order integration tests
docs: update api integration guide
```

## API Integration Phases

### Phase 1 – API Foundation
- API client
- Environment configuration
- Authentication
- Users
- Roles
- Permissions
- Branch context
- Categories
- Products
- Tables

### Phase 2 – Orders / Reception / KOT
- Orders
- Submit
- Confirmation
- Rejection
- KOT
- KOT modification
- Kitchen monitoring

### Phase 3 – Billing / Payments / Reports
- Bill generation
- Tax
- Discounts
- Payments
- Mixed payment
- Customers
- Reports

### Phase 4 – Hardening
- Permission regression
- Error handling
- Token refresh
- Idempotency
- Performance
- Responsive testing
- Production build
- UAT

## Documentation

Important documents:

```text
AGENTS.md
docs/APP_INTEGRATION_PLAN.md
docs/restaurant-pos-development-specification.md
```

During API integration, additional documents may include:

```text
docs/API_INTEGRATION_MATRIX.md
docs/API_MIGRATION_PLAN.md
docs/API_INTEGRATION_TEST_RESULTS.md
```

Keep documentation synchronized with important architecture/API changes.

## Security

Never commit:
- `.env`
- secrets
- passwords
- tokens
- API keys
- production credentials

Use `.env.example` as the template.

Frontend permission checks improve UX, but the Django backend must enforce authorization.

## Definition of Done

A feature is complete when:

- functionality works
- data is persisted correctly
- repository/service layer is used
- permissions are respected
- validation works
- loading/error states work
- audit behavior is implemented where applicable
- tests are added/updated
- lint passes
- production build passes
- browser verification is complete
- no critical console errors remain
- documentation is updated when needed

## License / Ownership

Add the final project license/ownership statement here when it is formally decided.
