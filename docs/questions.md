# Business logic questions log

Record of questions raised while interpreting the HomeCareOps prompt (`metadata.json`), with working hypotheses and how we intend to resolve them in implementation.

---

## Order request vs. payment and capacity release

**Question:** The prompt describes submitting an “order request” when a slot is available, but does not define whether payment is captured at submission, on completion, or not at all for this offline marketplace. It also does not say how long a slot stays reserved or what happens if the customer abandons checkout.

**My understanding:** Treat “order request” as a firm booking that holds capacity from successful submit until the order is completed, cancelled by staff, or explicitly timed out. Assume no external payment gateway in scope unless added later; if no payment, capacity still must be released on cancellation or SLA-based expiry.

**Solution:** Model orders with explicit states (e.g., `pending_confirmation`, `confirmed`, `in_progress`, `completed`, `cancelled`) and release slot capacity in the same atomic transaction as cancellation or timeout. Document payment as out-of-scope or stubbed if the product owner confirms.

---

## Travel zones and “not serviceable” beyond 20 miles

**Question:** Travel fees are given as tiers by mile radius, but the prompt does not say how distance is computed (straight-line vs. driving), who supplies the customer location (address, coordinates, manual mileage), or whether zones are global defaults or per-service.

**My understanding:** Use a single configurable zone model per tenant or per catalog: customer provides a service address (or selects a saved address); the backend maps that to a zone using a stored rule set (e.g., distance from a fixed depot or from nearest service area centroid). Beyond max radius, checkout is blocked with a clear “not serviceable” error.

**Solution:** Store zone breakpoints and fees in MongoDB; add a `computeTravelFee(addressOrCoords)` path used at quote and checkout. If geocoding is out of scope, allow a simplified “miles from depot” numeric input for the MVP with a TODO for real geodesy.

---

## Sales-tax toggle and jurisdictions

**Question:** A “sales-tax toggle for jurisdictions that require it” is mentioned, but it is unclear whether the customer turns tax on/off, whether tax is calculated from a jurisdiction table, or how rates are maintained.

**My understanding:** “Toggle” means the quote and checkout APIs accept a jurisdiction identifier (or zip/state) and apply a stored rate when the jurisdiction is marked tax-required; non-privileged users should not arbitrarily disable tax if the law requires it—staff configure which jurisdictions require tax and the UI reflects that.

**Solution:** Model `jurisdiction` documents with `taxRequired` and `rate`; expose tax as part of server-computed pricing. Customer-facing UI shows estimated tax when applicable; admins maintain rates. If the prompt intended a literal end-user toggle for training/demo only, gate it behind an admin “demo mode” flag.

---

## After-hours multiplier and same-day surcharge boundaries

**Question:** After-hours is defined as 7:00 PM–7:00 AM and same-day adds $25 when “less than 4 hours’ notice,” but time zone, “notice” relative to slot start, and stacking with other rules are not fully specified.

**My understanding:** All scheduling uses one configured business time zone (or per-location zone later). “Notice” is the interval between `bookingRequestedAt` and scheduled slot start. After-hours applies to the scheduled window (e.g., if any part of the visit falls in after-hours, or if start time is in that window—pick one rule and document it). Same-day surcharge stacks with duration tiers unless the spec says otherwise.

**Solution:** Implement pricing as an ordered pipeline: base + duration tiers + travel + same-day flag + after-hours multiplier (define whether multiplier applies to subtotal before or after travel in code comments and API docs). Store `timezone` on the organization or settings collection.

---

## Bundles vs. multi-spec selection and compare-to-five

**Question:** “Multi-spec and bundle selection” is not defined: whether bundles are fixed SKUs with their own price, whether compare is only for catalog items or includes configured variants, and how validation interacts when a bundle contains services with conflicting capacity.

**My understanding:** Bundles are first-class catalog entities with their own `lineItems` and a bundle-level price or sum-of-parts with a discount flag. Multi-spec is multiple configurable line items on one order. Compare tracks up to five catalog service IDs (resolved to latest published version) and shows the last quoted configuration per item where applicable.

**Solution:** Represent bundles in MongoDB with embedded child service references; run capacity checks per underlying resource requirement. Enforce `compareList.length <= 5` in API and UI.

---

## Q&A on service detail pages

**Question:** Customers can “review Q&A,” but the prompt does not say who may post questions or answers, whether answers are official-only, or how moderation relates to Q&A vs. reviews.

**My understanding:** Q&A is public content: customers ask; answers may come from Service Managers or approved staff roles only to avoid misinformation. Alternatively, community answers require moderator approval—default to staff-only answers for offline/trusted ops.

**Solution:** Model `Question` / `Answer` with `answeredByRole` and moderation state aligned with content rules; if community answers are allowed, reuse the sensitive-term quarantine path for Moderators.

---

## Complaint ticket SLAs: business hours, holidays, and pauses

**Question:** First response within 8 business hours and resolution within 5 business days are given, but business hours calendar, holidays, and whether the SLA clock pauses when waiting on the customer are unspecified.

**My understanding:** Use a configurable business calendar (e.g., 9–5 Mon–Fri) stored in settings; SLA due timestamps are computed in UTC with business-hour arithmetic. Pausing when status is `waiting_on_customer` is the usual interpretation unless legal says otherwise.

**Solution:** Store SLA targets on ticket category; compute `firstResponseDueAt` and `resolutionDueAt` at creation using a small SLA library or service; persist immutable outcome records when resolved, per prompt.

---

## Administrator vs. Service Manager vs. Moderator

**Question:** Separate consoles are named, but overlapping duties (e.g., who edits catalog vs. who publishes content) and whether a user can hold multiple roles are not defined.

**My understanding:** Administrator: org settings, users, security policies. Service Manager: catalog, pricing rules, capacity calendars. Moderator: reviews, Q&A quarantine, dispute/ticket outcomes visibility. Users may have multiple roles in MongoDB via an array field.

**Solution:** Implement RBAC with role arrays and route guards per console; document each role’s allowed actions in `api-spec.md` as you define endpoints.

---

## Review window: 14 days from what event, and partial order completion

**Question:** “After completion” triggers the 14-day review window, but multi-service orders, partial completion, and timezone boundaries for “day 14” are not spelled out.

**My understanding:** The window opens when the order enters `completed` and closes 14 calendar days later at end of day in the org time zone (or 14×24h from completion timestamp for simpler implementation).

**Solution:** Store `completedAt` and `reviewEligibleUntil`; enforce one review per order in the reviews collection with a unique index on `orderId`.

---

## Media retention vs. legal hold and review images

**Question:** Closed ticket attachments delete after 365 days unless legally held; review images (up to 6×10 MB) are not given an explicit retention rule and may still be referenced from published reviews.

**My understanding:** Ticket evidence follows the 365-day policy with a `legalHold` flag blocking deletion. Review media remains until the review is deleted or a separate retention policy is added; SHA-256 dedup and reference counting apply to all uploaded blobs.

**Solution:** Tag assets with `purpose` (`ticket`, `review`, `content`) and run retention jobs per tag; legal hold is a boolean on the ticket or case document that suppresses blob GC.

---

## Search index weekly cleanup and “orphaned” entries

**Question:** The prompt mentions removing orphaned index entries weekly but does not define orphan criteria (deleted services, rolled-back content versions, etc.).

**My understanding:** Orphans are text-index documents whose source document no longer exists or whose `searchVersion` no longer matches the published version (e.g., after rollback).

**Solution:** Maintain a deterministic `searchDocId` tied to published content; the job deletes text-index rows whose parent `_id` is missing or whose `updatedAt` is older than the source’s published revision.

---

## New-device login anomaly flags

**Question:** “Anomaly flags for new-device logins” does not specify whether login is blocked, requires admin approval, or only logs an audit event.

**My understanding:** Non-blocking by default: record device fingerprint or user-agent hash, set `isNewDevice`, notify the user via inbox, and surface on the audit log; optional stricter mode can be a future setting.

**Solution:** Add `loginAudit` collection entries with `deviceId` hash; configurable policy enum `log_only | notify | challenge` starting with `log_only` and `notify`.
