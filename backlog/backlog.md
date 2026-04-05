# Backlog

Tasks deferred from the UI production readiness review. To be prioritised and scheduled later.
See also: [`CLAUDE.md`](../CLAUDE.md) for project conventions.

---

## 🔴 Critical

---

### CRIT-1. Persistent Session After Password Reset — Security Review
**Reported:** 2026-04-05
**Category:** Security / Auth
**Priority:** High

**Problem:** After resetting password, refreshing the page signs the user back in automatically. The user should be fully signed out and required to log in with their new password. This is a security risk — anyone with physical or remote access to the browser at the time of a password reset would remain authenticated.

**Root cause (suspected):**
Supabase persists the session JWT in `localStorage` by default. When a password reset is triggered, Supabase issues a recovery token and fires `SIGNED_IN` via `onAuthStateChange` (`App.jsx:286`). The `authRecovery.js` logic detects the `recovery` AMR claim and blocks dashboard access (`needsNewPassword` flow), but if the user refreshes *after* setting a new password, the new session token is stored in localStorage and the `onAuthStateChange` re-fires `SIGNED_IN` — letting them straight in without re-entering credentials.

**Files to investigate:**
- `frontend/src/App.jsx:232-289` — `onAuthStateChange` / `applySession` logic
- `frontend/src/lib/authRecovery.js` — recovery token detection
- `frontend/src/lib/supabase.js` — Supabase client config (no `persistSession` or `autoRefreshToken` overrides currently set)
- `frontend/src/components/LoginScreen.jsx` — sign-in / sign-up / forgot password flows

**Fix checklist:**
- [ ] After a successful password update (`USER_UPDATED` event), call `supabase.auth.signOut()` and force the user back to the login screen — require them to sign in with the new password
- [ ] Verify `passwordRecoveryPending` ref is correctly reset in all exit paths
- [ ] Review whether `persistSession: false` is appropriate for this app (merchant dashboard — shared devices possible)
- [ ] Ensure the "Forgot password" email link cannot be replayed (Supabase one-time token — verify it is consumed correctly)
- [ ] Test: sign in → request password reset → open link → set new password → refresh → must see login screen, not dashboard
- [ ] Test: sign in → request password reset → do NOT set new password → refresh → must see login screen
- [ ] Test: sign in normally → sign out → refresh → must see login screen (no auto re-auth)
- [ ] Test: sign in → close tab → reopen → decide and document expected behaviour (session expiry policy)
- [ ] Review all Supabase auth events handled in `applySession` for gaps: `INITIAL_SESSION`, `TOKEN_REFRESHED`, `USER_UPDATED`, `PASSWORD_RECOVERY`, `SIGNED_OUT`

---

## 🟠 High

---

### HIGH-1. `formatZAR` Not Applied Globally
**Reported:** 2026-04-05
**Category:** Localisation / UX
**Files:** `PaymentsTable.jsx:114`, `AccountingView.jsx:142-161` (and many more), `VATReportingView.jsx:228`

**Problem:** `formatZAR()` was introduced in Phase 1 and applied to `ReceiptItemsCard`, but the majority of currency displays across the app still use the old `{currencySymbol} {amount.toFixed(2)}` pattern. This produces `R 1234.56` (with space, no thousands separator) instead of the correct `R1,234.56`.

**Fix:**
- Import `formatZAR` from `../lib/format.js` in each file
- Replace all instances of `` `${currencySymbol}${amount.toFixed(2)}` `` and `{currencySymbol} {amount.toFixed(2)}`
- `currencySymbol` prop can be removed from components once `formatZAR` is used throughout (it hardcodes "R" from `Intl`)
- Run `grep -rn "toFixed\|currencySymbol" src/components` to find remaining instances

---

### HIGH-2. Phone Number Validation Missing
**Reported:** 2026-04-05
**Category:** UX / Data Quality
**Files:** `EmployeesView.jsx:29-33`, `MerchantDashboard.jsx` (invoice send form)

**Problem:** Phone number fields accept any string. SA mobile numbers must be 10 digits starting with `0` (e.g. `0711234567`) or 11 digits with `+27` prefix. Invalid numbers sent via WhatsApp checkout links will silently fail.

**Potential fix:**
```js
function isValidSAPhone(value) {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('27')) return digits.length === 11;
  if (digits.startsWith('0')) return digits.length === 10;
  return false;
}
```
- Show inline error on blur: "Enter a valid SA mobile number (e.g. 071 234 5678)"
- Block form submission if invalid

---

### HIGH-3. `console.error` / `console.warn` Exposed in Production
**Reported:** 2026-04-05
**Category:** Security / Performance
**Files:** `App.jsx:367,449,479,499,513,578,604,631,685,915,930,938,996,1035,1069,1130` (15+ calls)

**Problem:** All API error handlers use bare `console.error()` / `console.warn()`. In production these expose internal API endpoint URLs, error messages, and stack traces to anyone with DevTools open. They also clutter the console for legitimate debugging.

**Potential fix:**
```js
// Replace:
console.error("Failed to load payment intents", err);

// With:
if (import.meta.env.DEV) console.error("Failed to load payment intents", err);
```
Or integrate an error monitoring service (Sentry) and remove console calls entirely. Sentry's free tier is sufficient for this scale.

---

## 🟡 Medium

---

### MED-1. Artificial `setTimeout` Delays Feel Like Hangs
**Reported:** 2026-04-05
**Category:** UX / Performance
**Files:** `CheckoutView.jsx:57,100,147` (bank auth simulation), `MerchantDashboard.jsx:248,416` (bank link simulation)

**Problem:** Demo bank authentication uses hardcoded `setTimeout` delays of 1–4 seconds (`MerchantDashboard.jsx:416` uses 4 seconds). These are blocking, give no progress feedback, and feel like the app has frozen. They are also scattered through real code paths rather than isolated to demo/mock logic.

**Potential fix:**
- Gate all fake delays behind an env flag: `if (import.meta.env.VITE_DEMO_MODE === 'true')`
- Replace with real API call response time when backend is ready
- If demo mode is needed, add a visible progress indicator (spinner + "Connecting to bank…" message) for the duration

---

### MED-2. Responsive Breakpoints Not Implemented
**Reported:** 2026-04-05
**Category:** Mobile Responsiveness
**Files:** `PhoneFrame.css`, `TabletFrame.css`, `App.css`, modal styles in `MerchantDashboard.jsx`

**Problem:** Phase 2 plan includes responsive breakpoints at 768px and 1024px. The e2e overflow tests currently pass (no horizontal scroll) but modal widths are fixed in pixels and may clip on narrow screens when the dashboard is accessed directly (not through the phone frame).

**Potential fix:**
- Add `max-width: 100%; width: min(520px, 100vw)` to `.phone-frame`
- Replace fixed-pixel modal widths with `min(480px, calc(100vw - 32px))`
- Add `padding: env(safe-area-inset-bottom)` to Toast for notched iPhones

---

### MED-3. Loading States Inconsistent Across Views
**Reported:** 2026-04-05
**Category:** UX
**Files:** `AccountingView.jsx`, `VATReportingView.jsx`, `EmployeesView.jsx:137-140`

**Problem:** `PaymentsTable` has a skeleton loader. `AccountingView` and `VATReportingView` show plain text or nothing during data fetches. `EmployeesView` shows generic "Loading…" text. Users on slow connections see blank panels.

**Potential fix:**
- Create a shared `<SkeletonRow count={n} />` component in `src/components/`
- Use it in `AccountingView`, `VATReportingView`, and `EmployeesView` while data loads
- Show spinner on action buttons (e.g. "Send Invoice") during in-flight requests

---

### MED-4. API Errors Silently Swallowed — No User Feedback
**Reported:** 2026-04-05
**Category:** Error Handling / UX
**Files:** `App.jsx:449,479,499,513` (payment intents, employees), `MerchantDashboard.jsx` (invoice send, bank link)

**Problem:** Most `catch` blocks log to console but do not show anything to the user. A failed invoice send, failed employee load, or failed payment refresh gives no indication of failure — the UI just stays as-is.

**Potential fix:**
- Pass a `showToast(message, type)` callback down from `App.jsx` (Toast already exists in `Toast.jsx`)
- In each catch block call `showToast("Failed to load payments. Please try again.", "error")`
- Block the "Send Invoice" button from re-enabling after a failed send until the user changes input

---

## 🟢 Low

---

### LOW-1. `formatDateZA` Not Applied Globally
**Reported:** 2026-04-05
**Category:** Localisation
**Files:** `AccountingView.jsx:567`, `VATReportingView.jsx:222`, `PaymentsTable.jsx` (date columns), `SuccessView.jsx:18`

**Problem:** `formatDateZA()` was created in Phase 1 but not applied. Multiple components still call `new Date(x).toLocaleDateString()` or `toLocaleString()` without specifying `'en-ZA'` locale, producing inconsistent date formats across the app.

**Potential fix:**
- Import and use `formatDateZA(date)` from `../lib/format.js` in all components that display dates
- Run `grep -rn "toLocaleDateString\|toLocaleString" src/` to find all instances

---

### LOW-2. Invoice Description Has No Character Limit Feedback
**Reported:** 2026-04-05
**Category:** UX
**Files:** `MerchantDashboard.jsx` (invoice description textarea, approx lines 1380–1450)

**Problem:** The invoice description textarea has no visible character counter. Users can type past the backend's likely limit and only discover the issue on submit failure.

**Potential fix:**
```jsx
<textarea maxLength={255} value={description} onChange={...} />
<small>{description.length}/255</small>
```

---

### LOW-3. Button Sizing and Inline Styles Inconsistent
**Reported:** 2026-04-05
**Category:** Visual Polish
**Files:** `PaymentsTable.jsx:144-176`, `MerchantDashboard.jsx` (multiple buttons with inline `style={{fontSize: "0.85rem"}}`)

**Problem:** Some buttons use inline `style` overrides instead of CSS classes. Touch targets are inconsistent — some ghost buttons in the payments table may be below the 44px WCAG minimum on mobile.

**Potential fix:**
- Add CSS utility classes: `.btn-sm`, `.btn-md`, `.btn-lg`
- Remove inline `style={{fontSize: ...}}` from buttons
- Verify all touch targets with `min-height: 44px` in the base button styles

---

### CRIT-2. PIN and Credentials Handling
**Reported:** from UI review
**Category:** Security / UX
**Files:** `CheckoutView.jsx:462-487`, `MerchantDashboard.jsx` (PIN-related code)

**Problem:** Bank credentials collected without clear security reassurance. No explicit clearing of sensitive state on unmount. State holding credentials persists in memory for the lifetime of the component.

**Potential fix:**
- Add security reassurance copy near credential fields: "Your credentials are never stored on our servers"
- On component unmount, clear credential state: `useEffect(() => () => setBankCredentials({ username: '', password: '' }), [])`
- Ensure `autoComplete="off"` on bank username/password inputs (not just the password field)
- Consider a 5-minute inactivity timeout that clears in-progress credential state
