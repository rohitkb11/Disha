# Architecture

Sites provides Vinext/React routing, Cloudflare Worker deployment, managed identity and D1. Drizzle manages schema; Dexie manages IndexedDB; MiniSearch retrieves references; json-logic-js evaluates labelled sample rules; Lucide supplies icons. Product inspiration and actual OSS reuse are distinguished in THIRD_PARTY_NOTICES.md.

## Authorization

The platform supplies trusted identity. `x-disha-workspace` selects another centre only through an active server membership. Site audience and application membership are distinct gates. `lib/access.ts` defines permissions; state is filtered server-side and sync authorizes both existing and proposed records.

Owners manage membership; teachers manage centre records; linked learners see their own records and published learning/opportunities. Notes stay facilitator-only. Mentors access participant sessions; employers manage their own opportunities and received submissions. Invitation tokens are random, hashed at rest, email-bound, single-use and expire in 48 hours. Revocation applies to subsequent online API requests.

## Data and offline behavior

`workspaces`, `records`, `processed_events` store ownership, typed versioned snapshots and replay acknowledgements. `memberships`, `invitations`, `audit_log` handle delegated access and audit. `mentor_sessions`, `session_messages` store scheduling/conversations. `submissions` stores immutable consented application snapshots and decisions. `payments`, `entitlements` store provider references and content access; no card details. `service_counters` supplies durable per-user/action limits.

Record IDs are namespaced by the authorized workspace. Browser edits and outbox snapshots enter one IndexedDB transaction. Event IDs are idempotent; revisions reject stale writes while retaining conflict drafts. Current permissions filter replay. A revoked online request does not fall back to cached authorization. Workspace switching requires pending work to be resolved.

The service worker caches application assets, never API/authentication responses. Prepared snapshots remain on a disconnected device, including previously downloaded paid content. Immediate remote revocation or DRM while disconnected is not promised. An unlocked shared browser can expose local data. Signing out clears the device copy. Migrations 0000–0002 are immutable; generate new migrations for later changes.

## Providers

Guidance retrieves catalogue sources, then calls Cloudflare Workers AI or configured Ollama. Only education/interests/goals and contact-redacted questions are sent, excluding names/income. JSON shape, source IDs, URLs and selected numerical claims are checked; this does not prove every statement is grounded. Timeout/failure uses a labelled retrieval response. Hosted Workers cannot reach the user's localhost.

Feeds use a fixed administrator-configured HTTPS endpoint or authorized facilitator JSON export. Payloads are validated before import. Source availability checks establish reachability only. Imported opportunities use external provider forms and never gain invented automatic eligibility.

Only an active linked employer receives an in-app application. External government/provider forms remain external. Session chat is visible to participants and facilitators; there is no external email/SMS/video integration.

Razorpay hosted links handle financial details. Disha verifies provider reference, amount, currency and paid status before access; subscriptions require an active paid provider period. Raw-body HMAC verifies callbacks and replay cannot extend one-time access. Private site access may block provider webhooks; authenticated reconciliation remains available. Refund/dispute operations require a separate merchant pilot before commercial use.

All sixteen starter lessons have aligned Hindi/Marathi assessments. Common UI text uses explicit React dictionaries. Custom/provider content, career descriptions and some dynamic statuses remain in the original language. Actual regional speech, memory use and low-end Android performance require physical device validation.
