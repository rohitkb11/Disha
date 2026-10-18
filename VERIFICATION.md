# Verification record — 2026-10-18

## Submission release — sprint 14

- `npm run verify` passed locally on Windows with Node 24.14.1: TypeScript, **34 unit/domain/security/provider-contract tests**, production build, **15 offline assets** and **69 compiled Worker HTTP assertions**.
- New request tests cover exact JSON media types, malformed JSON, UTF-8 byte limits without Content-Length, split regional characters, early cancellation of oversized provider responses and bounded draining of rejected uploads. HTTP checks verify rejection followed by a working request without mutation retries.
- The integration runner creates a separate secret-free local D1 store, applies all four migrations, repeats migration without replaying schema changes, uses a free loopback port and stops its Worker automatically. It does not use merchant/AI/feed credentials or modify the development database. GitHub CI runs the same verification command.
- `npm run db:migrate` recognized the pre-existing four-migration development schema and preserved application records. Unknown schemas stop for inspection rather than replaying old DDL.
- `npm run test:api` passed against the development server: anonymous/spoofed access, same-origin writes, validation, durable writes, replay idempotency and stale revision conflicts.
- Browser verification reproduced and resolved a stale development service-worker cache that mixed React module versions. Development now unregisters Disha's old shell cache before reload and registers the offline worker only in production. The dashboard loaded, persisted sample progress appeared, and Marathi navigation switched successfully. A current dashboard screenshot is included in `docs/screenshots/dashboard.png`.
- README now includes reproducible setup and verification; SUBMISSION.md contains the solution, demo sequence, architecture map and explicitly outstanding external validation. The research and pilot screenshot retain their 17 October provenance.

## Prior release — 2026-10-17

## Sprint 13

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
