# Verification record — 2026-10-17

## Current release — sprint 13

- Expanded suite: **29 automated tests passed**, including actual SQLite execution of all four immutable migrations and reconciliation writes against simulated provider responses. Covers payment-time expiry, stable replay, expired passes, full/partial refunds, stale paid replies, provider outages, invalid capture references and subscription paid-period/cancellation/renewal behavior. No merchant sandbox charge is claimed.
- **65 compiled Worker HTTP assertions passed**, adding owner-only pilot access, forbidden teacher/learner/mentor/employer access, known check IDs, required evidence, persisted blocked results and reset behavior.
- Production build and TypeScript checks passed. Migration 0003 applied locally.
- Browser verified the new owner Pilot tab, configuration-presence labels, all eleven acceptance checks, saving a blocked Android result and retrieving that result again after leaving/reopening the tab. No physical Android pass was recorded. Pilot UI guidance is primarily English; shared controls and result labels have Hindi/Marathi translations.

## Previous release regression evidence

- TypeScript compilation: passed.
- Unit/domain/security suite: 16 tests passed. Covers interest-dependent recommendations, unknown eligibility, progress normalization, translations/answer alignment, role permissions, record validation, HMAC forgery, payment amount/reference/currency checks and AI adapter failure behavior.
- Compiled Worker HTTP suite: 54 assertions passed using six independent disposable local `.test` identities. Covers owner/student/teacher/mentor/employer roles, private learner records and notes, invitation claims/reuse, forbidden writes, paid lesson/progress gates, mentor confirmation/messages/overlap protection, application consent/duplicates/partner review, provider import validation, unconfigured checkout and access revocation.
- Five-stage production build: passed; 15 bundled offline assets generated.
- Real local Ollama inference through the new adapter returned `mode: ollama`, a substantive answer and source ID 1. Hosted Cloudflare inference is not activated. Contract tests use injected provider responses; they do not prove multilingual answer quality.
- Browser verified owner community screens, invitation form, Hindi/Marathi live language switching, translated roles/tabs and disabled checkout without credentials. Layout inspected at the available narrow browser viewport. This is not physical Android testing.
- Prepared production-shell cache, stopped the local compiled server, cold-reloaded and opened an incomplete lesson. Completed its assessment offline; another reload retained 50% progress and one queued change. Restarted the server and reloaded: progress remained at 50% and the queue returned to All changes saved.

The feed HTTP test exposed a workerd request-stream error after a rejected request left its body unread. The handler now consumes bounded input before asynchronous authorization; the complete HTTP suite then passed without retries. No failing request was retried as a successful mutation.

## Prior release evidence

The original profile/sync API checks passed unauthenticated/spoofed identity rejection, origin checks, durable snapshots, replay idempotency and stale revision conflicts. Browser checks covered profile interview/review, lesson persistence, unknown eligibility, external checklists, facilitator notes/assignments and original module publishing. The previous production-shell offline recovery check also passed.

## Not claimed

No live Razorpay charge, merchant sandbox purchase, recurring renewal, refund or dispute flow has been exercised with a real merchant account. Subscription refunds/disputes still need merchant-specific handling; one-time refund reconciliation is covered by contract/storage tests only. Hosted AI/feed keys, provider webhook reachability through the private site gate, live consenting partner onboarding, microphone permissions/regional voices and low-end Android hardware remain activation/pilot requirements. See INTEGRATIONS.md. All bundled source dates are snapshots, not proof of live eligibility or vacancies. Some dynamic/catalogue/provider text remains in its original language.
