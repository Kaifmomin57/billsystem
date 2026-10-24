# BillTrack UX Redesign PRD v2

Revised edition. Scope is the UX redesign only. Infrastructure work is split out (Section 9). Contrast values were calculated from the hex codes and should be re-checked with a contrast tool before sign-off.

## 1. What changed from v1

| Issue in v1 | Resolution in v2 |
| --- | --- |
| UX and infrastructure mixed in one document | Infrastructure (v1 Sections 30 to 38) moved to a separate PRD; contract changes listed for explicit approval (Section 9) |
| Primary button colour failed contrast | Button fill darkened to emerald-700; hover darkened instead of lightened (Section 4) |
| Typo "WguilCAG AA" | Fixed to "WCAG AA" |
| Accent colour rules contradicted each other | One rule defined (Section 4) |
| Table text size stated three ways | One type rule defined (Section 3) |
| Disabled-submit rule conflicted with ledger confirmation | Explicit exception defined (Section 3) |
| Two overlapping plans (Phases 1 to 4 and P0 to P2) | Merged into one roadmap (Section 7) |
| No baselines, risks, language plan, or owners | Added (Sections 5, 6, 8) |
| Component filenames and query keys inside the PRD | Moved to an engineering appendix (Section 10) |

## 2. Summary and goals

BillTrack is a billing and ledger-management web app for small and medium businesses. The redesign makes it easier to understand, faster to operate, and more trustworthy, especially for users aged 45 and above.

Every screen must let the user answer three questions quickly:

1. What needs my attention today?
2. What action should I take next?
3. Did the action complete successfully?

**Non-negotiable constraint:** existing routes, field names, billing and tax calculations, API contracts, PDF content, and WhatsApp templates do not change without explicit written approval.

**Out of scope:** billing or tax rule changes, database schema changes, new payment gateways, role and permission redesign, full light theme, PDF and WhatsApp content changes.

## 3. Resolved standards (single source of truth)

These rules replace every conflicting statement in v1.

| Topic | Rule |
| --- | --- |
| Reading text | 16px for body copy, form fields, and primary actions |
| Table text | 16px by default; 14px allowed only for secondary columns such as dates and references |
| Supporting text | 14px minimum |
| Metadata | 12px minimum, only for timestamps and compact labels |
| Controls | 44px minimum height on touch and desktop; 48px for primary form submit and login |
| Desktop hit area | Visual size may be smaller only if the real hit area is at least 24 by 24px; mobile always 44px |
| Table rows | 52px minimum height |
| Submit buttons | Enabled until the user submits; then show a loading label such as `Saving bill…` |
| **Exception to the above** | The final `Create bills` button in Upload Ledger may be disabled while blocking review issues remain. A visible line directly above it must state how many issues block creation and link to the first one |
| Status | Always icon plus text label; never colour alone |
| Money | Right-aligned, tabular numerals, Indian digit grouping (for example ₹1,25,000.00), Indian date format (DD/MM/YYYY) |
| Icons | One icon family (Phosphor); icon-only controls need an accessible label, tooltip on hover and focus, and 44px touch target |

## 4. Contrast-checked colour tokens

**Colour rule:** emerald is the only action colour. Amber, rose, and sky appear only as status signals, always with an icon and label. Sky is informational only and never used for buttons.

**Problem found in v1:** white text on `#059669` is about 3.8:1, below the 4.5:1 WCAG AA requirement for normal text. The v1 hover colour `#10B981` is lighter, which would reduce contrast further. Both are corrected below.

| Token | Hex | Use | Approx. contrast |
| --- | --- | --- | --- |
| `surface-canvas` | `#09090B` | Page background | n/a |
| `surface-raised` | `#18181B` | Cards, sidebar, dialogs | n/a |
| `surface-input` | `#27272A` | Inputs | n/a |
| `text-primary` | `#F4F4F5` | Headings, key values | above 15:1 on canvas |
| `text-secondary` | `#D4D4D8` | Standard copy | above 11:1 on raised |
| `text-muted` | `#A1A1AA` | Supporting text | about 6 to 8:1 on canvas and raised; about 5:1 on input |
| `action-primary` (changed) | `#047857` | Button fill, selected nav | white text about 5.5:1 (passes) |
| `action-primary-hover` (changed) | `#065F46` | Hover and pressed | white text about 7.5:1 (passes) |
| `action-text` (new) | `#34D399` | Emerald used as text or icon on dark surfaces | above 8:1 on raised |
| `border-default` | `#3F3F46` | Decorative card and table dividers | decorative only |
| `border-control` (new) | `#71717A` | Input, select, and checkbox borders | about 3.1 to 3.7:1 against adjacent surfaces (meets 3:1 for UI components) |
| `focus-ring` (new) | `#6EE7B7` | 2px focus-visible outline with 2px offset | above 10:1 |
| `status-success` | `#34D399` | Paid | above 8:1 |
| `status-warning` | `#FBBF24` | Partially paid, needs review | above 9:1 |
| `status-danger` | `#FB7185` | Payment due, errors | above 6:1 |
| `status-info` | `#38BDF8` | Informational only | above 7:1 |

Issue also found: v1 used `#3F3F46` and `#52525B` as field borders, which are far below the 3:1 non-text contrast guideline for form controls. Use `border-control` for anything the user must find and operate.

## 5. Success metrics with baselines

Targets in v1 had no starting point. Capture baselines before any redesigned screen ships.

| Metric | Baseline method (before launch) | Target |
| --- | --- | --- |
| Time to create a standard bill (existing customer, 2 products) | Time 5 or more staff users on the current UI; record the median | 25% faster than baseline |
| Payment recorded without help | Observed task on current UI | At least 4 of 5 in testing, then at least 90% in production analytics |
| Upload review completed without abandoning | Count of upload sessions started vs bills created over 4 weeks | At least 80% |
| Form validation errors per bill | Instrument error events on current forms for 2 to 4 weeks | 30% fewer |
| Ease of use | 1 to 5 rating after each test task | Average at least 4 |
| Mobile primary-task success | Observed tests on a real phone | At least 90% |

**Measurement notes**

- A five-user test finds usability problems but cannot prove a 90% completion rate. Use it as a directional gate; confirm targets through production analytics.
- Add lightweight, privacy-safe event tracking (page, action, success or failure, duration). Do not log customer names, amounts, or phone numbers in analytics.
- Run a post-launch review at 2 and 6 weeks against baseline.

## 6. Risks and rollout

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Experienced staff resist layout changes | Slower work in first weeks, rejection | Release one section at a time; keep navigation order stable; short in-app "What changed" note |
| Redesign accidentally changes billing behaviour | Wrong invoices or balances | Regression test suite on calculations, PDF output, and WhatsApp messages before each release |
| Ledger review stays too complex | Abandonment | Test with 3 real ledger photos early; ship review queue before polish |
| Slow or unreliable connections | Lost entries, duplicate submissions | Preserve form data on failure; show connection-problem message; never auto-retry a financial write |
| Low contrast or small targets slip through | Accessibility failure | Contrast and keyboard checks in the Definition of Done |
| Scope creep from infrastructure items | Delay | Infrastructure tracked separately (Section 9) |

**Rollout approach**

1. Ship Phase 1 behind a feature flag to internal users.
2. Release to 2 to 3 friendly customers for one week.
3. Release to all, keeping the old interface available for 2 weeks where technically feasible.
4. Remove the old interface only after metrics meet or beat baseline.

## 7. Merged roadmap

This replaces v1 Phases 1 to 4 and the P0 to P2 backlog. Estimates are relative sizes (S under 1 week, M 1 to 2 weeks, L 2 to 4 weeks, XL over 4 weeks). Owners and dates must be filled in by the team.

| Phase | Priority | Scope | Size | Owner | Target |
| --- | --- | --- | --- | --- | --- |
| 0. Preparation | P0 | Capture baseline metrics; set up analytics events; confirm contrast-checked tokens; regression test suite for billing, PDF, WhatsApp | M | To assign | To set |
| 1. Foundation | P0 | Design tokens; Button, Input, FormField, StatusBadge, EmptyState, Skeleton, ConfirmDialog, Modal, PageHeader; responsive shell; navigation and mobile drawer; login; focus and 44px target basics | L | To assign | To set |
| 2. Daily billing | P0 | Dashboard hierarchy; Bills list with status filters; bill editor; payment collection; bill action menu; customer lookup and form; customer detail view | XL | To assign | To set |
| 3. Catalogue and rates | P1 | Products; Rates with `Test price`; URL-based filters; unsaved-change warnings | L | To assign | To set |
| 4. Ledger and reports | P1 | Four-step Upload Ledger with review queue; Reports with date presets and exports; Ledger settings | XL | To assign | To set |
| 5. Quality and launch | P0 | Mobile, tablet, laptop, wide-desktop testing; keyboard and contrast audit; usability test; rollout steps in Section 6 | M | To assign | To set |
| 6. Polish | P2 | Saved views; column visibility; keyboard shortcuts; density preference; light theme (separate decision) | L | To assign | Later |

**Release gates:** each phase ends only when its pages meet the Definition of Done in Section 11 and no regression is found in billing calculations.

## 8. Language and localisation decision

Many target users work in Hindi, Marathi, or other languages, and handwritten ledgers may not be in English. This affects layout and the ledger review flow, so decide early.

- **Phase 1 decision needed:** which interface languages ship first (recommended: English plus Hindi and Marathi as a second release).
- Build all text through a translation layer from the start, even if only English ships first.
- Allow 30 to 40% longer text in buttons, tabs, and table headers; never truncate action labels.
- Fonts must support Devanagari. Geist does not cover it, so define a fallback font stack and test line heights.
- Ledger OCR: confirm which handwriting languages the current provider supports, and show the detected language in the review step.
- Keep Indian number grouping and DD/MM/YYYY dates in every language.

## 9. Infrastructure: separated from this PRD

V1 Sections 30 to 38 (API gateway, Redis, queues, workers, object storage, observability, disaster recovery) are valuable but are a different project with different owners. They also contradict the rule that API contracts do not change.

**Action:** create a separate "BillTrack Reliability and Scale PRD" containing those sections. Until it is approved, the UX redesign must work with the current API.

**Contract changes the infrastructure PRD would require, each needing explicit approval:**

| Change | Why it is a contract change |
| --- | --- |
| `Idempotency-Key` header on bill and payment creation | New request header and replay behaviour |
| OCR scan returns `202 Accepted` with `job_id` and status URL | Response shape and client flow change |
| Async PDF and Excel export with job status | Synchronous downloads become polled jobs |
| `429` responses with `Retry-After` | New client-visible error handling |
| Signed URLs for uploads and PDFs | Download links change |

**What the UX redesign can do now without any API change:** layout-shaped skeletons, retained data during refresh, preserved form values, clear error and retry messages, disabling duplicate clicks while a request is pending, and polling the existing endpoints if they already expose progress.

**Kept from v1 as the minimum UX contract:** every upload, bill, payment, report, PDF, and WhatsApp action ends in one visible final state: completed, failed, or needs action.

## 10. Engineering appendix (move to technical design doc)

These items were product-level detail in v1. They are guidance for engineers, not product requirements.

- Component layers: Foundation, Primitives, Composites, Feature components, Pages.
- Buttons use `variant` (`primary`, `secondary`, `quiet`, `danger`) and `size` (`sm`, `md`, `lg`).
- Server state in React Query with keys that include resource and filters; forms in React Hook Form; multi-step bill and ledger flows with `useReducer`; durable views (filters, date range, tab) in URL search parameters.
- Mutations invalidate only affected queries. No optimistic updates for bills, payments, or ledger confirmation.
- No customer financial data, passwords, or draft invoices in browser storage.
- Suggested folders: `components/ui`, `components/billing`, `components/ledger`.
- Use native semantic elements: `button`, `a` or router `Link`, `label`, `table` with `th scope`.
- Use `aria-live="polite"` for non-blocking messages; animate only opacity and transform; respect `prefers-reduced-motion`; never use `transition: all`.
- Set `color-scheme: dark` and a matching theme colour.
- Review each page against the Vercel Web Interface Guidelines as a helper, but pass or fail is decided by Section 11 of this document, not by any external tool.

## 11. Definition of Done per page

A page is complete only when all of these are true:

1. Title, one-sentence purpose, and primary action are visible without scrolling on desktop.
2. It follows the screen structure: header, filters, priority information, main area, feedback states.
3. Loading, empty, error, sparse, and dense states are designed and tested.
4. It works at mobile, tablet, laptop, and wide-desktop widths with no accidental horizontal scroll.
5. Forms have visible labels, plain-language errors beside fields, preserved values after failure, and the first invalid field focused after submit.
6. Every destructive action names the affected record in its confirmation.
7. Every money-changing action shows what is happening, whether it completed, what changed, and what to do next.
8. Keyboard-only completion works; focus is always visible and never hidden by a sticky bar; modals trap focus and return it on close.
9. All text and control contrast values meet WCAG AA using the Section 4 tokens.
10. Billing logic, API behaviour, PDF content, and WhatsApp messages are unchanged, confirmed by the regression suite.

## 12. Page requirements (condensed)

All pages use the same structure: title and primary action, one-sentence purpose, filter bar, priority information, main working area, state feedback. Maximum two header actions; the rest go in a `More actions` menu.

| Page | Purpose | Primary action | Key requirements |
| --- | --- | --- | --- |
| Login | Sign in securely | Sign in | Large fields; labelled show-password control; error shown beside the form; no version text; paste allowed |
| Dashboard | See today's business health | Create bill | Today context and last-updated time; total sales, payments received, amount due, bills count; highest-due customers with `Collect payment`; recent bills table; first-use guidance |
| Bills | Create, send, and collect | Create bill | Filters with counts: All, Payment due, Partially paid, Paid; one next action per row (`Record payment`, `Download PDF`, or `Send on WhatsApp`); other actions in `More actions` |
| Bill editor | Build an accurate bill | Create bill | Sections: Customer, Items, Payment, Review; previous balance shown before items; running total always visible; review summary before confirm |
| Customers | Find customers and dues | Add customer | Columns: Customer, Mobile, Outstanding, Last bill, Status, Actions; `View bills`; edit and delete in `More actions`; simple form with optional section |
| Customer detail | See one customer's dues | Record payment | Outstanding amount, oldest bill date, open bills; reach payment within 3 steps after search |
| Products | Maintain catalogue and prices | Add product | Columns: Product, Code, Unit, Standard rate, Live rate, Status; explain why a product cannot be deleted |
| Rates | Set prices used in bills | Save rate | Intro line; tabs: Standard rates, Customer-specific rates, Rate history; `Test price` tool at top; show source and date for history |
| Upload Ledger | Turn a ledger photo into bills | Scan ledger, then Create bills | Four steps: Upload photo, AI scan, Review data, Create bills; side-by-side image and data on desktop; review queue of only items needing attention; saved-draft indicator; acknowledgement before creating bills; results with Bills link and Excel export |
| Reports | Understand performance | Download selected report | Date presets (Today, This week, This month, Custom); four summary values: Sales, Collected, Outstanding, Bills created; no-data message names the date range |
| Ledger settings | Configure how ledgers are read | Add mapping, alias, or tag | Three tabs with descriptions; active or inactive shown with text; delete separated from edit and confirmed |

## 13. Critical user journeys (testing priority)

Prototype and test these before visual polish.

1. **Create and send a bill:** start, select customer and see previous due, add items with running total, set payment, review summary, create, then offer `Download PDF`, `Send on WhatsApp`, `Record payment`, `View bill`.
2. **Record a payment:** open panel with bill context, show total, paid so far, and due; enter amount, method, date, optional reference; confirm; show new balance and status.
3. **Digitise a ledger:** upload, scan with plain-language progress, review only flagged items with a reason and fix path, confirm summary, see created vs skipped bills.
4. **Find a customer due:** search by name or mobile, see outstanding amount and oldest bill, open bills, record payment, confirm updated balance.

**Usability test:** at least 5 target users, including people aged 45 or older. Tasks: find total due today; create a 2-product bill; record a partial cash payment; find a customer with a balance; upload and review a ledger; download a customer report for a date range; add a product with a standard rate. Exit criteria: at least 4 of 5 complete each P0 task unaided, average confidence at least 4 of 5, and no unnoticed payment, bill, or review error.

## 14. Open decisions for the team

1. Interface languages for the first release (Section 8).
2. Owners and target dates for each phase (Section 7).
3. Whether the old interface can stay available during rollout (Section 6).
4. Which infrastructure contract changes to approve, and when (Section 9).
5. Whether Upload Ledger can poll the existing endpoint for progress, or must wait for the job-based API.

## 15. Product principle

BillTrack should feel like a dependable billing assistant: clear before clever, guided before complex, and always explicit about money, status, and the next action.
