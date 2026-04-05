# UI Production Readiness Plan
**Project:** Shesha Merchant — Bank-to-bank payments, invoicing, reconciliation & admin for South African small businesses/freelancers
**Reviewed:** 2026-04-04

---

## ACCESSIBILITY (WCAG AA Compliance)

### 1. Missing Form Labels and Semantic HTML
**Files:** `CheckoutView.jsx:459-487`, `EmployeesView.jsx:76-122`, `VATReportingView.jsx:98-145`, `ReceiptItemsCard.jsx:20-67`
**Category:** Accessibility
**Problem:** Multiple input fields lack proper `htmlFor` association with labels. Bank username/password fields in CheckoutView modal use placeholder-only labels.
**Fix:**
- Add consistent `htmlFor` on all labels referencing input `id` attributes
- Implement visible labels for all form inputs (not placeholder-only)
- Add ARIA live regions for form validation errors
- Use semantic HTML5 input types (`type="email"`, `type="tel"`)

---

### 2. Insufficient ARIA Labels and Roles
**Files:** `Toast.jsx`, `PhoneFrame.jsx`, `MerchantDashboard.jsx`, `PaymentsTable.jsx`
**Category:** Accessibility
**Problem:** Interactive elements lack descriptive ARIA labels. Modals, buttons, and dynamic content updates lack proper ARIA attributes for screen readers.
**Fix:**
- Add `aria-label` to all icon-only buttons (e.g., close buttons at `CheckoutView.jsx:439`)
- Implement `aria-live="polite"` regions for status updates and error messages
- Add `role="dialog"` and `aria-modal="true"` to modal overlays
- Use `aria-describedby` to link form fields with validation messages
- Add `aria-busy="true/false"` during loading states

---

### 3. Missing Focus Indicators and Keyboard Navigation
**Files:** `App.css:52-55`, `LoginScreen.css:81-86`, all component files
**Category:** Accessibility / UX
**Problem:** Many custom buttons and interactive elements don't have visible focus indicators. Modal overlays may trap focus poorly.
**Fix:**
- Ensure all interactive elements have visible `:focus` and `:focus-visible` styles
- Implement focus trap management for modals (`CheckoutView`, `MerchantDashboard`)
- Add keyboard event handlers for Enter/Escape keys on modals
- Document keyboard shortcuts (e.g., Escape to close modals)

---

### 4. Color Contrast Issues
**Files:** `App.css`, `LoginScreen.css`, `PhoneFrame.css`
**Category:** Accessibility
**Problem:** Gray text on light backgrounds (e.g., `.metric-label` styles, `var(--muted)` colors) may not meet WCAG AA contrast ratios (4.5:1 for text, 3:1 for UI).
**Fix:**
- Audit all color combinations against WCAG AA
- Increase contrast for muted text labels
- Ensure error messages use icon/symbol in addition to red color (not color alone)
- Test with contrast checker tool

---

## ERROR HANDLING & EMPTY STATES

### 5. Inconsistent Error Messaging and Missing User Feedback
**Files:** `CheckoutView.jsx:399-404`, `LoginScreen.jsx:14-38`, `MerchantDashboard.jsx:710-830`
**Category:** Error Handling / UX
**Problem:** Network errors are caught but not always displayed to users clearly. Some errors appear only in console. No retry mechanisms after API failures.
**Fix:**
- Display all caught errors in Toast notification or error panel
- Provide actionable error messages with suggested next steps
- Implement retry buttons for failed API calls
- Add fallback UI states for offline scenarios
- Show validation errors immediately as user types

---

### 6. Missing Loading States and Skeleton Screens
**Files:** `PaymentsTable.jsx:81-90`, `EmployeesView.jsx:137-140`, `MerchantDashboard.jsx` (various)
**Category:** UX / Performance
**Problem:** Basic skeleton loaders exist in PaymentsTable but other views show plain "Loading..." text. No visual feedback during long operations (bank auth takes 2-4 seconds).
**Fix:**
- Use consistent skeleton loader components across all data-loading sections
- Show animated spinners for actions taking >500ms
- Disable buttons during loading with "(Loading...)" state text
- Add progress indicators for multi-step flows (PIN entry, bank auth)
- Implement proper loading states in VAT and Accounting views

---

### 7. Empty State Handling
**Files:** `PaymentsTable.jsx:97-101`, `EmployeesView.jsx:141-146`, `VATReportingView.jsx:248-254`
**Category:** UX
**Problem:** Empty states are minimal. First-time users see generic "No payment intents yet" messages without guidance.
**Fix:**
- Add contextual empty state messaging with calls-to-action
- Show icons or illustrations
- Link to onboarding or help docs from empty states

---

## SOUTH AFRICAN CONTEXT & LOCALISATION

### 8. Currency Formatting Not Localised
**Files:** `ReceiptItemsCard.jsx:117-130`, `PaymentsTable.jsx:114`, `AccountingView.jsx` (multiple), all components using `{currencySymbol}`
**Category:** Localisation
**Problem:** Numbers use `.toFixed(2)` without thousand separators. Amounts display as "R 1234.56" instead of "R1,234.56". Date formatting uses `toLocaleString()` with "en-ZA" but inconsistently.
**Fix:**
- Create a utility function: `formatZAR(amount)` returning "R1,234.56"
- Use `Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" })` consistently
- Implement consistent date formatting using `formatDateZA(date, includeTime)` across all components

---

### 9. Missing South African Context in UI Copy
**Files:** `CheckoutView.jsx:75-80` (bank list), `LoginScreen.jsx`, `EmployeesView.jsx:83`
**Category:** Localisation / UX
**Problem:** Bank list is hardcoded. VAT at 15% (correct) is not clearly labeled as South Africa standard. SA-familiar payment terminology (EFT) not used.
**Fix:**
- Make bank list dynamic (load from API or config)
- Use SA-familiar terminology: "Instant EFT" or "Bank Transfer"
- Clearly label VAT rate as "South Africa standard (15%)" in VATReportingView
- Add more SA phone number format examples in placeholders

---

### 10. Date Format Inconsistency
**Files:** `SuccessView.jsx:18`, `CheckoutView.jsx:191-195`, `VATReportingView.jsx:222`, `AccountingView.jsx` (multiple)
**Category:** Localisation / UX
**Problem:** Inconsistent mix of `toLocaleString()`, `toLocaleDateString()` with and without "en-ZA" locale.
**Fix:**
- Create `formatDateZA(date, includeTime = false)` utility and use consistently
- Add format hint text (e.g., "DD/MM/YYYY") to date input fields

---

## SECURITY & SENSITIVE DATA

### 11. Static Security Badges
**Files:** `CheckoutView.jsx:407-419`, `SuccessView.jsx:417-419`
**Category:** Security / UX
**Problem:** Security badges ("Bank-level security", "256-bit encryption") are static and not connected to real verification.
**Fix:**
- Display HTTPS/secure connection status dynamically
- Position security indicators prominently in bank credential flows

---

## FORM VALIDATION & UX

### 12. Weak Form Validation
**Files:** `LoginScreen.jsx:40-49,62-80`, `EmployeesView.jsx:29-33`, `ReceiptItemsCard.jsx:18-71`
**Category:** UX / Error Handling
**Problem:** Phone number validation missing entirely. Bank account number accepts any string. No real-time validation feedback.
**Fix:**
- Implement SA phone number validation (+27 or 0 prefix, 10 digits)
- Add bank account number format validation (most SA banks: 12 digits)
- Show validation errors in real-time on field blur
- Add max-length limits on all text inputs
- Use `type="tel"` and `inputmode="numeric"` appropriately

---

### 13. Receipt/Invoice Item Management Issues
**Files:** `ReceiptItemsCard.jsx:69-71,140`
**Category:** UX
**Problem:** Add Item doesn't clear form after submission. Quantity defaults to empty string instead of 1. No max item count.
**Fix:**
- Clear form inputs after successful item addition
- Set quantity default to 1
- Add max 20 items per invoice warning
- Show toast notification when item is added successfully

---

## MOBILE RESPONSIVENESS & UI POLISH

### 14. Remove Dead Demo Files — PhoneFrame + TabletFrame CSS
**Files:** `PhoneFrame.jsx`, `PhoneFrame.css`, `TabletFrame.css`
**Category:** Clean-up / Mobile Responsiveness
**Problem:** `PhoneFrame.jsx` (fake phone bezel with "9:41" status bar and emoji icons) is not imported anywhere in `App.jsx` — it is dead demo code. `TabletFrame.jsx` IS used but only renders `<div className="dashboard-wrapper">` and does not import `TabletFrame.css`. The tablet bezel styles in `TabletFrame.css` (900×1200px fixed frame, gradient background) are therefore also unused.

Responsive concerns previously attributed to `PhoneFrame.css` (Toast positioning, overflow at mobile widths) actually belong to `App.css` and the real checkout/dashboard layout — not these demo wrappers.

**Fix:**
- Delete `PhoneFrame.jsx` and `PhoneFrame.css`
- Delete `TabletFrame.css` (TabletFrame.jsx does not use it)
- Verify nothing breaks after deletion (grep for `.phone-frame`, `.phone-content`, `.tablet-frame-container` to confirm no live usage)
- Move any genuinely needed styles from `TabletFrame.css` into `App.css` (check `.dashboard-wrapper` definition)
- Responsive breakpoints and modal widths should be fixed in `App.css` and `MerchantDashboard.jsx` directly

---

### 15. Inconsistent Button Sizing and Spacing
**Files:** `App.css:38-55`, `PaymentsTable.jsx:144-176`, `MerchantDashboard.jsx` (various)
**Category:** Mobile Responsiveness / Visual Polish
**Problem:** Inline `style={{fontSize: "0.85rem"}}` scattered throughout. Button padding varies without clear system. Ghost buttons in tables too small on mobile.
**Fix:**
- Create button size variants: `button-sm`, `button-md`, `button-lg`
- Consolidate inline styles into CSS classes
- Ensure all touch targets 44x44px minimum
- Review `ghost-button` sizing on mobile

---

### 16. Fragile Toast Positioning
**Files:** `App.css` (Toast styles), `Toast.jsx`
**Category:** Mobile Responsiveness / UX
**Problem:** Toast is positioned absolutely/fixed but doesn't account for safe-area insets on notched iPhones. The positioning logic was previously in `PhoneFrame.css` (now confirmed dead code) — actual Toast styles need to be located and fixed in `App.css`.
**Fix:**
- Set `bottom: max(20px, env(safe-area-inset-bottom))` on the Toast container
- Add safe-area padding for notched devices
- Implement toast queue for multiple simultaneous notifications

---

### 17. Input Focus States and Mobile Keyboard Handling
**Files:** `App.css`, `LoginScreen.css:81-86`
**Category:** Accessibility / Mobile Responsiveness
**Problem:** Mobile devices trigger focus on tap, making focus states visible unexpectedly. Number inputs don't block non-numeric input.
**Fix:**
- Use `:focus-visible` to show outlines only on keyboard focus
- Use `inputmode="numeric"` and `pattern="[0-9]*"` for number/price fields
- Implement blur-on-Enter for mobile form fields

---

## PERFORMANCE & OPTIMISATION

### 18. `Math.random()` as React Key (Critical Anti-Pattern)
**Files:** `AccountingView.jsx:569,695`, `VATReportingView.jsx:224`, `ReceiptItemsCard.jsx:76`
**Category:** Performance — CRITICAL
**Problem:** `key={Math.random()}` causes full unmount/remount of components on every render. Destroys internal state and causes focus loss. Also `key={\`${item.name}-${index}\`}` is suboptimal for reorderable lists.
**Fix:**
- Use stable, unique IDs from backend data
- If no ID exists, use index only for non-reorderable static lists
- Never use `Math.random()` or computed values as React keys

---

### 19. Console Logging in Production
**Files:** `CheckoutView.jsx:124,170`, `MerchantDashboard.jsx:76,158,214` (and more)
**Category:** Performance / Security
**Problem:** Multiple `console.error()` and `console.warn()` statements clutter production browser console. Some may expose internal API details.
**Fix:**
- Wrap all console statements: `if (process.env.NODE_ENV === 'development') { console.log(...) }`
- Consider integrating Sentry or LogRocket for production error reporting
- Sanitize error messages shown to users

---

### 20. Artificial setTimeout Delays
**Files:** `CheckoutView.jsx:55-63,98-130,145-180`, `MerchantDashboard.jsx:248-251,416-424`
**Category:** UX / Performance
**Problem:** Hardcoded 1-4 second delays simulate bank auth. 4-second delay in bank linking (`MerchantDashboard.jsx:416`) feels artificial and slow.
**Fix:**
- Remove hardcoded delays or gate them behind a `DEMO_MODE` env flag
- Resolve loading state immediately when actual API responds
- Add progress indicators for genuinely multi-second operations

---

## VISUAL POLISH & DESIGN CONSISTENCY

### 21. Inconsistent Color and Spacing Theming
**Files:** `App.css`, component-specific CSS files
**Category:** Visual Polish
**Problem:** Inline colors like `#ef4444` used instead of CSS variables. Spacing uses mixed px and em units. Border-radius varies (12px, 16px, 50px) without clear scale.
**Fix:**
- Define and use CSS variables for all colors: `--primary`, `--success`, `--error`, `--warning`, `--muted`
- Standardise spacing on 4px scale: 4, 8, 12, 16, 24, 32px
- Standardise border-radius: `--radius-sm: 6px`, `--radius-md: 12px`, `--radius-lg: 16px`
- Define shadow scale: `--shadow-sm`, `--shadow-md`, `--shadow-lg`

---

### 22. Overdue Invoice Visual Treatment
**Files:** `MerchantDashboard.jsx:1485-1530`, `PaymentsTable.jsx:120-130`
**Category:** UX / Visual Polish
**Problem:** Overdue invoices not highlighted in main Order History. Reminder count is subtle gray text with no visual urgency.
**Fix:**
- Add red/orange "OVERDUE" badge to affected order history rows
- Apply light red background to overdue rows
- Show reminder count more prominently
- Sort overdue items to top of payment list

---

### 23. Bank Card Visual Hierarchy
**Files:** `App.css:154-180`, `MerchantDashboard.jsx`
**Category:** Visual Polish / UX
**Problem:** "Link bank" button doesn't stand out as the primary action when bank is unlinked.
**Fix:**
- Make "Link bank" button primary (green/filled) on unlinked card
- Use secondary/outline button on linked card for "Update"
- Add bank icon to card header for visual context

---

## CROSS-BROWSER & PLATFORM

### 24. Deprecated CSS and Vendor Prefix Issues
**Files:** `PhoneFrame.css:100-140`, `LoginScreen.css`
**Category:** Cross-browser Compatibility
**Problem:** Uses `-webkit-overflow-scrolling: touch` which is deprecated. Safari scrollbar hiding needs prefix but modern browsers don't.
**Fix:**
- Remove `-webkit-overflow-scrolling: touch`
- Keep `-webkit-scrollbar` rules for Safari compatibility
- Test on: iOS Safari, Chrome, Firefox, Edge
- Document minimum browser versions supported

---

### 25. localStorage Access Without Error Handling
**Files:** `CheckoutView.jsx:36`
**Category:** Error Handling / Browser Compatibility
**Problem:** `localStorage.getItem('sheshaPay_savedPhone')` not wrapped in try-catch. Private browsing mode blocks localStorage access.
**Fix:**
```js
function getSavedPhone() {
  try {
    return localStorage.getItem('sheshaPay_savedPhone');
  } catch {
    return null;
  }
}
```

---

## INVOICE & PAYMENT FLOW

### 26. Invoice Description UI/UX Issues
**Files:** `MerchantDashboard.jsx:1380-1450`, `PaymentsTable.jsx:132`
**Category:** UX
**Problem:** Invoice description textarea has no character limit feedback. No preview before sending. Phone number input lacks formatting guidance.
**Fix:**
- Add character counter to description textarea (max 255 chars)
- Show invoice preview before sending
- Implement phone number formatting as user types
- Add "Copy to clipboard" button for checkout link

---

## PRIORITY SUMMARY

| Priority | # | Category | Effort |
|----------|---|----------|--------|
| Critical | 3 | `Math.random()` keys, API error handling, Accessibility (labels/ARIA) | Medium |
| High | 6 | ZAR currency formatting, SA phone validation, Mobile responsiveness, Form validation, localStorage error handling, Toast positioning | Medium |
| Medium | 8 | Loading/empty states, Visual polish, Localised dates, Overdue badges, Credential UX, Console logs | Low–Medium |
| Low | 5 | Design tokens, Vendor prefixes, Artificial delays, Button sizing, Invoice preview | Low |

---

## IMPLEMENTATION PHASES

### Phase 1 — Pre-Launch Critical
**Changes:**
- Fix `Math.random()` React keys in `AccountingView.jsx`, `VATReportingView.jsx`, `ReceiptItemsCard.jsx` → use stable IDs
- Add `htmlFor` / ARIA attributes on all forms across `CheckoutView`, `EmployeesView`, `VATReportingView`, `ReceiptItemsCard`
- Implement `formatZAR()` and `formatDateZA()` utility functions and apply across all components
- Implement SA phone number validation in `EmployeesView` and `MerchantDashboard` invoice form
- Wrap `localStorage.getItem('sheshaPay_savedPhone')` in try-catch at `CheckoutView.jsx:36`
- Display all API errors in Toast/UI (remove silent failures in `CheckoutView`, `MerchantDashboard`)

**Manual Testing — Phase 1**

_Currency & Dates_
1. Log in and open the Merchant Dashboard
2. Confirm all Rand amounts show as `R1,234.56` (comma thousands separator, no space after R)
3. Open Order History — confirm dates display as `DD/MM/YYYY` (e.g., `05/04/2026`)
4. Open Accounting view — confirm all totals and line items use same ZAR format
5. Open VAT Reporting — confirm VAT amounts and totals are ZAR formatted

_Forms & Validation_
6. Go to the customer checkout page (`/pay`)
7. On the phone number field, enter an invalid number (e.g., `123`) and try to proceed — confirm an error message appears
8. Enter a valid SA number (`0711234567` or `+27711234567`) — confirm it is accepted
9. On the Add Employee form (`EmployeesView`), enter an invalid phone number — confirm inline error
10. On ReceiptItemsCard, add an item — confirm it clears the form after submission

_Error Handling_
11. With DevTools Network tab open, block the API endpoint and trigger a payment — confirm a Toast error appears (not just a console log)
12. Open the app in a private/incognito window — confirm it loads without a JavaScript crash (localStorage try-catch working)

_Accessibility_
13. Tab through the checkout form — confirm every input is reachable and has a visible focus ring
14. Right-click each form input and Inspect — confirm `<label>` elements have `for` attributes matching input `id`s
15. Check the browser console — confirm no React key warnings (e.g., `Each child in a list should have a unique "key" prop`)

---

### Phase 2 — Production Hardening
**Changes:**
- Consistent skeleton/loading states across `EmployeesView`, `AccountingView`, `VATReportingView`
- Responsive breakpoints at 768px and 1024px in `PhoneFrame.css` and modals
- Form validation with real-time feedback (on blur) across all forms
- Fix Toast positioning with `env(safe-area-inset-bottom)` in `PhoneFrame.css`

**Manual Testing — Phase 2**

_Loading States_
1. Open the Merchant Dashboard on a throttled connection (DevTools → Network → Slow 3G)
2. Navigate to Accounting view — confirm a skeleton loader or spinner appears while data loads (not blank or plain "Loading...")
3. Navigate to VAT Reporting — same check
4. Click "Send Invoice" — confirm the button shows a disabled/loading state while the request is in flight

_Mobile Responsiveness_
5. Open DevTools → Toggle device toolbar → set width to **375px** (iPhone SE)
   - Confirm the phone frame fills the screen edge to edge with no horizontal scroll
   - Confirm all buttons are tappable (≥44px height)
   - Confirm the Toast notification appears above the bottom of the screen (not cut off)
6. Set width to **768px** (iPad)
   - Confirm the tablet frame is visible and content fits without overflow
   - Confirm modals (bank link, QR code) don't extend beyond the screen
7. Set width to **1024px** (iPad Pro landscape)
   - Confirm layout adapts and nothing is clipped

_Real-time Validation_
8. On the checkout phone number field, enter a number, then tab away — confirm error shows immediately on blur (not only on submit)
9. On the Add Employee form, fill in all fields correctly — confirm no error shown
10. On ReceiptItemsCard, set quantity to 0 — confirm an inline error appears

_Toast on Mobile_
11. At 375px width, trigger any action that shows a Toast (e.g., copy checkout link)
12. Confirm the Toast is fully visible and not hidden behind the browser nav bar or home indicator

---

### Phase 3 — Polish & Optimisation
**Changes:**
- Standardise design tokens (CSS variables for colors, spacing, radius, shadows) across `App.css` and component CSS files
- Gate console logs behind `NODE_ENV === 'development'`
- Remove artificial `setTimeout` delays or gate behind `DEMO_MODE` env flag
- Overdue invoice badges and sorting in `PaymentsTable` and `MerchantDashboard`
- Invoice preview before sending

**Manual Testing — Phase 3**

_Console Cleanliness_
1. Open the app in a production build (`npm run build && npm run preview` or deployed URL)
2. Open DevTools Console — confirm zero `console.log`, `console.warn`, `console.error` output during normal use
3. Trigger a payment flow — confirm no internal API details are logged

_Performance & Delays_
4. Click "Link Bank Account" — confirm the flow completes without an artificial 4-second pause (or that it is clearly a demo spinner, not a hang)
5. Run through the full checkout flow — confirm no hardcoded delays that make the app feel frozen

_Overdue Invoices_
6. Find or create a payment intent that is past its due date
7. Open Order History — confirm an "OVERDUE" badge is visible on that row
8. Confirm overdue rows sort to the top of the list

_Visual Consistency_
9. Open `App.css` in DevTools Sources — confirm inline hex colours like `#ef4444` are replaced with CSS variables
10. Check border-radius and spacing across Login, Dashboard, and Checkout — confirm consistent visual rhythm (no element that looks obviously out of place compared to others)

_Invoice Preview_
11. On the Dashboard, fill in the invoice form and click the send/preview action
12. Confirm a preview of the invoice (amount, description, recipient) is shown before confirming send

---

### General Testing Checklist (All Phases)
- [ ] WCAG 2.1 AA: tab navigation reaches all interactive elements
- [ ] WCAG 2.1 AA: all text meets 4.5:1 contrast ratio (use browser DevTools accessibility panel)
- [ ] WCAG 2.1 AA: error messages are not communicated by colour alone
- [ ] Mobile: iPhone SE (375px), iPhone 12 Pro (390px), iPad (768px), iPad Pro (1024px)
- [ ] Network: Slow 3G — all views show loading state; Offline — app shows error, does not crash
- [ ] Cross-browser: Safari (iOS 16+), Chrome, Firefox, Edge
- [ ] SA locale: amounts display as `R1,234.56`; dates as `DD/MM/YYYY`; VAT clearly labelled as 15%
- [ ] Private/incognito window: app loads without JS crash
- [ ] Screen reader (optional but recommended): VoiceOver on iOS, NVDA on Windows
