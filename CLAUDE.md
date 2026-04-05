# Shesha Merchant — Claude Guidelines

## Project Overview
Bank-to-bank payment, invoicing, reconciliation, and admin dashboard for self-employed South Africans (freelancers / small businesses). Payments are ZAR-denominated and integrate with South African banks via a demo EFT flow.

## Stack
- **Frontend:** React 19, Vite 7, plain CSS (no framework)
- **Auth:** Supabase (email + password, password recovery flow)
- **Backend:** Node.js on AWS AppRunner (`/api/*` endpoints)
- **Deployment:** Frontend on AWS Amplify, backend on AppRunner

## Development Commands
```bash
# From repo root
npm run dev           # frontend only (localhost:5173)
npm run dev:full      # frontend + backend concurrently

# From frontend/
npm run e2e           # run all Playwright tests (all phases)
npm run e2e:phase1    # Phase 1 tests only
npm run e2e:phase2    # Phase 2 tests only
npm run e2e:phase3    # Phase 3 tests only
npm run lint          # ESLint
npm run build         # production build
```

## Key Conventions

### Currency
Always use `formatZAR(amount)` from `src/lib/format.js` for all Rand amounts.
Never use `{currencySymbol} {amount.toFixed(2)}` — this produces the wrong format for SA users.
```js
import { formatZAR } from "../lib/format.js";
// ✅ formatZAR(1234.5)  →  "R1,234.50"
// ❌ `R ${amount.toFixed(2)}`  →  "R 1234.50"
```

### Dates
Use `formatDateZA(date)` from `src/lib/format.js` for all displayed dates.
```js
import { formatDateZA } from "../lib/format.js";
// ✅ formatDateZA(date)           →  "05/04/2026"
// ✅ formatDateZA(date, true)     →  "05/04/2026, 10:30"
// ❌ new Date(x).toLocaleDateString()  →  inconsistent locale
```

### React List Keys
Never use `Math.random()` as a React key — it remounts the component on every render.
Use the item's stable ID from the backend. If no ID, use the map index as a last resort (only for static, non-reorderable lists).
```js
// ✅ key={payment.id || `payment-${idx}`}
// ❌ key={Math.random()}
```

### CSS Design Tokens
Use the semantic tokens defined in `App.css :root` — do not use raw hex values inline.
```css
/* ✅ */  color: var(--error);
/* ❌ */  color: #dc2626;
```

### E2E Tests
Run `npm run e2e` before pushing. Tests require the dev server to be running (Playwright starts it automatically via `webServer` in `playwright.config.js`).
The authenticated Phase 3 test (`overdue badge`) is skipped unless `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` env vars are set.

### Backlog
Tasks that are out of scope for the current work item but should be addressed later go in [`backlog/backlog.md`](./backlog/backlog.md).
Each entry needs: a problem description, affected files with line numbers, and a fix checklist.

---

## Architecture Notes
- `src/lib/format.js` — ZAR and date formatting utilities
- `src/lib/supabase.js` — Supabase client (null if env vars missing)
- `src/lib/authRecovery.js` — detects password-recovery sessions by decoding JWT `amr` claim
- `src/lib/api.js` — resolves API base URL (proxied through Vite in dev, direct in prod)
- `src/lib/apiAuth.js` — attaches Supabase JWT to API requests
- Route `/pay` or `/customer` → `CheckoutView` (public, customer-facing)
- Route `/` → `MerchantDashboard` (requires Supabase auth)
