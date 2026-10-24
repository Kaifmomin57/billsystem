# BillTrack Reliability and Scale PRD

Companion to the BillTrack UX Redesign PRD v2. This document holds the backend, infrastructure, and security work that was split out of the UX PRD. Items marked **Needs approval** change an API contract or client-visible behaviour and must be approved in writing before work starts.

## 1. Purpose and scope

BillTrack must stay fast and dependable as users, bills, ledger uploads, and report exports grow. Slow background work (OCR, PDF, exports, WhatsApp) must not slow down the everyday billing API.

**In scope:** gateway and edge protection, rate limits, timeouts, idempotency, background jobs, database and cache strategy, file storage, security, observability, and rollout.

**Out of scope:** UI redesign (see UX PRD v2), billing and tax rule changes, new payment gateways, multi-user role redesign, changes to PDF content or WhatsApp templates.

**Guiding rule:** do not build a complex microservice system before measurements show a single API deployment cannot meet demand. Grow in stages (Section 12).

## 2. Relationship to the UX redesign

| UX feature | Backend dependency | Works without this PRD? |
| --- | --- | --- |
| Skeletons, retained data, retry buttons | None | Yes |
| Preserved form values and duplicate-click protection | None | Yes (client side only) |
| Safe payment and bill submission after a timeout | Idempotency keys (Section 6) | Partly; the UI cannot guarantee no duplicates without it |
| Upload Ledger progress that survives refresh | Job-based OCR (Section 7) | Only if the existing endpoint exposes progress |
| Large report and PDF export with status | Job-based exports (Section 7) | Small exports only |
| Friendly message when rate limited | `429` with `Retry-After` (Section 5) | Generic error only |

The UX team should build against the current API first and adopt these changes as they are approved.

## 3. Changes that need approval

| # | Change | Why it affects contracts | Approver | Status |
| --- | --- | --- | --- | --- |
| 1 | `Idempotency-Key` header on bill and payment creation | New request header and replay behaviour | To assign | Pending |
| 2 | OCR scan returns `202 Accepted` with `job_id` and status URL | Response shape and client flow change | To assign | Pending |
| 3 | Asynchronous PDF and Excel export with job status | Downloads become polled jobs | To assign | Pending |
| 4 | `429` responses with `Retry-After` and a readable message | New client-visible error | To assign | Pending |
| 5 | Signed, time-limited URLs for uploads and PDFs | Download links change | To assign | Pending |
| 6 | Migration from SQLite to managed PostgreSQL | Data migration; schema must stay equivalent | To assign | Pending |
| 7 | Request ID returned on every error response | Error body gains a field | To assign | Pending |

Where possible, add new behaviour in a backward-compatible way: the old response shape keeps working until the new UI ships.

## 4. Performance and reliability targets

### 4.1 User-facing targets

| Operation | Target | Slow-case behaviour |
| --- | --- | --- |
| Open a standard page | Main content within 2.5 seconds on normal 4G | Show skeleton after 150 to 300 ms |
| Search customers, products, bills | Results within 500 ms of server response | Debounce 250 to 300 ms; keep previous results visible |
| Create bill or record payment | Server acknowledgement within 2 seconds under normal load | Keep form values; show `Saving bill…`; block duplicates |
| Load first page of a table | Within 1.5 seconds | Matching skeleton rows and a retry action |
| Generate a PDF | Result within 15 seconds | Move to a background job if it regularly exceeds 5 seconds |
| Scan a ledger | Never hold the browser request open | Queue job, return job ID, show progress |
| Export a large report | Never hold the browser request open | Queue job, show status, offer download when ready |

### 4.2 Service-level objectives

- Availability: 99.9% per month for authenticated billing and payment endpoints.
- Error rate: under 1% of non-client-error requests over a rolling 30 minutes.
- Latency: p95 under 500 ms for routine reads and under 2 seconds for normal writes, excluding queued jobs and external providers.
- Every upload, bill, payment, report, PDF, and WhatsApp request must end in a visible final state: completed, failed, or needs action.

**Baseline first:** measure current latency, error rate, and traffic for two weeks before treating these as commitments. Adjust targets if the current system is far from them.

## 5. Target architecture

| Layer | Responsibility | Characteristics |
| --- | --- | --- |
| CDN and static hosting | Serve the React build, fonts, and public assets | Global caching, compression, cache-busted file names |
| API gateway or edge proxy | Protect, route, rate-limit, and observe requests | HTTPS, size limits, WAF rules, per-route timeouts |
| FastAPI replicas | Quick authenticated reads and writes | Stateless, horizontally scalable, no long provider calls inside request handlers |
| Managed PostgreSQL | Source of truth for customers, bills, payments, rates, audit records | Automatic backups, point-in-time recovery, connection pooling |
| Redis | Shared cache, distributed rate limits, short-lived job status | Managed; high availability only when scale justifies it |
| Object storage | Ledger images, generated PDFs, completed exports | Private by default, signed URLs, lifecycle rules |
| Job queue and workers | OCR, exports, PDFs, WhatsApp delivery, retries | Durable queue, idempotent jobs, concurrency limits, dead-letter handling |
| Observability | Detect slow, failing, or overloaded flows | Structured logs, metrics, traces, alerts |

The gateway can be a managed platform gateway, cloud load balancer, or dedicated service. This PRD does not choose a vendor.

### 5.1 Gateway responsibilities

- Terminate TLS and redirect HTTP to HTTPS.
- Forward only approved API paths to FastAPI.
- Attach a request ID to every request and pass it to application logs, worker logs, and error responses.
- Enforce request-size limits before traffic reaches application workers.
- Apply stricter limits to login, upload, PDF, report, OCR, and WhatsApp routes.
- Enforce CORS from an explicit production origin allowlist; never allow all origins in production.
- Apply WAF protection for common malicious traffic.
- Rate-limit by IP before login and by authenticated user after login.
- Apply per-route timeouts and return a clear timeout response with the request ID.
- Reject malformed content types and unsupported HTTP methods.
- Remove internal infrastructure headers from responses.

### 5.2 Initial rate limits

These are starting points to tune with real traffic. They do not replace authentication or authorization.

| Route group | Limit | Reason |
| --- | --- | --- |
| Login | 5 attempts per IP and username per 15 minutes | Limits password guessing |
| Routine reads | 120 per user per minute | Supports normal navigation and search |
| Routine writes | 30 per user per minute | Stops accidental rapid resubmission |
| Payment writes | 10 per user per minute, plus idempotency key | Protects financial records |
| Ledger image upload | 10 per user per hour | Controls OCR workload |
| OCR scan start | 5 per user per hour | Controls AI cost and worker congestion |
| PDF and Excel generation | 20 per user per hour | Prevents expensive generation abuse |
| WhatsApp send | 10 per user per hour | Protects provider limits |

**Points to check before enforcing:**

- Limit login by IP **and** username together. Offices often share one public IP, so an IP-only limit can lock out a whole shop after one person's typos.
- A busy business may process several ledger pages in one day. Confirm that 5 scans per hour fits real usage, and raise it if needed.
- WhatsApp at 10 per hour may be too low for bulk sending after a billing run. Review with real volumes.

When a request is limited, return HTTP `429` with `Retry-After` and a plain-language message. The UI must keep the user's form data.

## 6. Idempotency for financial writes (Needs approval: #1)

A bill or payment must never be created twice because of a retry, double click, or network drop.

- The client generates a unique `Idempotency-Key` for each bill-creation and payment attempt.
- The server stores the key, a hash of the request body, and the resulting response.
- Same key and same body: return the original successful result; do not create a second record.
- Same key and different body: reject with `409 Conflict` and a clear message.
- Keep keys for at least 24 hours.
- Idempotency storage and the database transaction are the source of truth; never serve a cached payment response in place of the real outcome.
- Clients must never retry a bill or payment write automatically without a key.
- The same protection applies to ledger-to-bills confirmation.

## 7. Background jobs for slow work (Needs approval: #2, #3)

Use jobs for OCR, image pre-processing, non-trivial PDFs, large Excel exports, and WhatsApp delivery.

**Flow**

1. Browser creates a job through a quick API call.
2. API checks permission and input, saves a durable job record, and queues the work.
3. API returns `202 Accepted` with `job_id`, initial status, and a status URL.
4. UI polls the status URL with increasing delay (server push can come later).
5. A worker processes the job with provider-specific timeouts and retry rules.
6. The worker saves output and final status together.
7. UI shows completion, error, retry, or the next action.

**Job states:** Queued, Processing, Needs review, Ready, Completed, Failed. Jobs must stay visible after a browser refresh and when the user returns later.

**Retry rules**

- Retry temporary provider and network failures with exponential backoff and jitter.
- Do not retry permanent problems: validation errors, invalid files, missing permissions, invalid phone numbers.
- Set a maximum retry count per job type; send exhausted jobs to a dead-letter list for review.
- Jobs must be idempotent: a retry must not create duplicate bills, PDFs, or WhatsApp messages.
- Record provider response, attempt count, timestamps, and a safe error category.

**Timeouts**

| Operation | Gateway timeout | Client behaviour | Server or worker behaviour |
| --- | --- | --- | --- |
| Standard read | 10 seconds | Offer retry; keep current content | Log slow queries above a threshold |
| Standard write | 20 seconds | Keep form data; show request ID on failure | Require idempotency key for financial writes |
| File upload transfer | 60 seconds | Retry only if the upload was not accepted | Store directly to object storage when possible |
| OCR, PDF, export, WhatsApp | Return quickly after job accepted | Poll job state | Worker continues without the browser session |

## 8. Database and caching

### 8.1 Database

- Production uses managed PostgreSQL. SQLite stays for local development and disposable tests only.
- The move to PostgreSQL must keep the data model equivalent to today's (Needs approval: #6). Run a trial migration with a copy of real data and compare row counts, balances, and report totals before cutover.
- Keep current indexes; add new ones only after reviewing slow-query metrics and query plans.
- Paginate bills, customers, products, reports, and upload history. Never send unbounded lists to the browser.
- Use database transactions for bill creation, payment recording, and ledger confirmation.
- Store money as exact decimals, never floating point. Verify how the current code stores amounts before migration.
- Enable encrypted backups and point-in-time recovery before launch; test a restore.
- Define retention for uploads, generated files, audit records, and job logs.

### 8.2 Cache plan

| Data | Cache policy | Invalidate when |
| --- | --- | --- |
| Products and standard rates | Shared, 5 to 15 minutes | Product or rate is updated |
| Customer search suggestions | Per user, 1 to 5 minutes | Customer is updated |
| Dashboard summary | Per user, 30 to 60 seconds | A bill or payment changes |
| Report summaries | By date range and filters, 1 to 5 minutes | A relevant financial write occurs |
| Job status | No long cache | Read from job store until final state |
| Auth and permissions | Not cached beyond secure token rules | Re-check on the server |

A stale dashboard right after recording a payment would look like a bug. After a bill or payment write, invalidate the affected dashboard and report caches immediately so the user sees the new numbers.

## 9. Security and data protection

- Move all secrets, API keys, and provider tokens to managed secret storage; never keep them in source files.
- **Rotate any secret that has ever appeared in a file, code review, log, terminal output, or shared document.**
- Use a separate strong secret key for each environment.
- Give database credentials least privilege per environment.
- Store ledger images and PDFs privately; serve them only through time-limited signed URLs to authorised users (Needs approval: #5).
- Before OCR, validate file type, file signature, size, dimensions, and that the image decodes.
- Scan or quarantine uploads if the platform supports it.
- Keep audit logs for bill creation, bill edits, payments, deletions, settings changes, exports, and WhatsApp sends.
- Redact passwords, keys, tokens, personal data, and financial details from logs and error trackers.
- Enforce HTTPS, secure headers, and a production CORS allowlist.

## 10. Observability and operations

### 10.1 Required telemetry

- Structured logs with request ID, route, user ID where safe, status, and duration.
- Metrics: request count, p50/p95/p99 latency, errors, rate-limit events, database pool use, cache hit rate, queue depth, job duration, worker failures.
- Traces across API, database, queue, OCR, PDF, and WhatsApp calls.
- Frontend error tracking and web-vitals (load, interaction delay, layout shift).

### 10.2 Alerts

Alert the operations owner when:

- p95 routine API latency exceeds 2 seconds for 10 minutes.
- Error rate exceeds 2% for 5 minutes.
- Queue depth grows continuously for 10 minutes.
- OCR or WhatsApp provider failures rise above normal.
- The database connection pool is close to exhaustion.
- Database or upload storage nears capacity.
- A backup fails or point-in-time recovery is unavailable.

### 10.3 Review cadence

| When | Review |
| --- | --- |
| Weekly | Slowest endpoints, queue failures, rate-limit events, user-facing errors |
| Monthly | Database and storage growth, largest reports, provider spend, peak traffic |
| Before seasonal or billing-cycle peaks | Load test critical routes and worker queues with realistic traffic |

## 11. Cost and ownership

The v1 document did not cover these, and they decide whether the plan is realistic.

- **Cost:** estimate monthly cost for managed PostgreSQL, Redis, object storage, gateway or WAF, monitoring, and OCR and WhatsApp provider usage at current and 5 times current volume.
- **Ownership:** name an operations owner for alerts, a person who approves contract changes, and an on-call contact for payment-related incidents.
- **Proportionality:** if current traffic is small, Stage 1 and Stage 2 may be enough for a long time. Do not buy Stage 3 and 4 capacity ahead of evidence.

## 12. Rollout plan

| Stage | Scope | Exit criteria |
| --- | --- | --- |
| 1. Production baseline | Frontend on CDN; one or more FastAPI instances behind a managed proxy; managed PostgreSQL with backups; current compression, health checks, indexes, and pooling kept; explicit production CORS; error tracking, structured logs, basic latency dashboards; secrets moved and rotated | Backups restore successfully; baseline latency and error rate recorded; no secrets in source |
| 2. Protect and offload | Gateway rate limits, WAF, request IDs, route timeouts; Redis for shared limits and short cache; OCR, exports, PDFs, and WhatsApp moved to durable jobs; object storage with signed URLs; idempotency keys for bills and payments | Duplicate-submission test creates no second record; jobs survive refresh and worker restart; rate limits tested on every route group |
| 3. Scale horizontally | Multiple stateless API replicas; workers scaled by queue depth and job latency; autoscaling limits that protect database and provider quotas; load tests of billing, payment, upload, and export peaks; read replicas only if reads are the proven bottleneck | Targets in Section 4 met under representative load |
| 4. Advanced resilience | Multi-zone database and cache where justified; dead-letter review tools; disaster recovery runbook and restore exercises; provider circuit breakers with friendly fallback messages; regional strategy only if real latency or availability needs appear | Restore exercise completed; failure of one provider does not block billing |

## 13. Production acceptance criteria

- All production traffic passes through an HTTPS gateway or proxy.
- Rate limits and size limits are enforced and tested for login, writes, uploads, OCR, PDF, export, and WhatsApp.
- Bill and payment endpoints require and honour idempotency keys.
- OCR, large exports, and provider-backed delivery never hold a normal API request open until completion.
- Jobs survive browser refresh, worker retry, and short provider outages without duplicate financial records.
- Every list is paginated or explicitly bounded.
- PostgreSQL backup and recovery are configured and a restore has been tested.
- Uploads and generated documents are private and reachable only through authorised, time-limited URLs.
- Dashboard, bills, and customer list meet Section 4 targets under representative load.
- Monitoring and alerts catch slow endpoints, failed jobs, traffic spikes, and failed backups.
- Billing and tax calculations, PDF content, and WhatsApp templates are unchanged, confirmed by regression tests.

## 14. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Database migration changes balances or totals | Wrong financial data | Trial migration on a copy; compare totals; keep rollback plan; migrate off-hours |
| Idempotency implemented incorrectly | Duplicate or blocked bills and payments | Test double-submit, timeout-retry, and changed-body cases before release |
| Rate limits too strict | Legitimate users blocked | Start in log-only mode, review events, then enforce |
| Job system adds new failure modes | Lost or stuck scans and exports | Dead-letter list, visible job states, alerts on queue depth |
| Cost grows faster than usage | Budget overrun | Cost estimate and monthly provider spend review |
| Changes land before the new UI can handle them | Broken screens | Backward-compatible responses; coordinate releases with the UX roadmap |

## 15. Open decisions

1. Hosting platform and gateway choice.
2. Who approves each contract change in Section 3, and by when.
3. Current traffic and data volumes, to decide how soon Stage 2 and 3 are needed.
4. Whether the existing OCR endpoint can expose progress today, so the UX team can ship the guided flow earlier.
5. Budget range for managed services.
6. Operations owner and incident contact.
