# Disha — learning to livelihood

Disha helps rural learners turn career exploration into a practical next step: build a profile, understand suitable pathways, try a vocation, learn a relevant skill, and prepare an opportunity application with a teacher or mentor.

## Problem and approach

Career information, learning resources, scholarships and support often sit in separate services. Disha connects them around a learner profile and a facilitator's follow-up. Recommendations explain which interests and education requirements contributed to a match. Missing income or eligibility information remains unknown; the app never treats a directory listing as proof of eligibility.

The implementation combines twelve career pathways, eight original courses and sixteen assessments with a learning passport, English/Hindi/Marathi support, browser speech alternatives and offline learning. Teachers can assign work, keep private notes and author modules. Separate mentor and employer accounts support consented in-app sessions and applications. External government and provider applications still use their own official websites.

## Run the submission

Requires Node 22.13+; Node 24 is used by CI. In a fresh clone:

```sh
npm ci
npm run db:migrate
npm run dev
```

Open `http://127.0.0.1:5173` and sign in using the local development sign-in. All core exploration, learning, profile and teacher workflows run without paid services or API keys. Two demonstration learner profiles appear in a new owner's centre. No local identity emulator is shipped in the hosted build.

To verify the submission independently:

```sh
npm run verify
```

This builds the actual Worker and checks separate-account authorization, invitations, private records, paid-content access gates, mentoring, partner applications, opportunity imports, pilot reporting and revocation against an isolated local D1 database. Payment and model unit tests use controlled provider responses; they do not claim a real merchant transaction or hosted model evaluation.

## Five-minute demo

1. **Profile → Discover:** select a labelled sample learner or add a profile. Change interests and compare explainable career matches. Open a pathway and its practical career trial.
2. **Learn → Passport:** open a free module, read a lesson and answer an assessment. Reload to show persisted progress, then inspect the passport and its export/print actions.
3. **Language:** change to Hindi or Marathi. Open a bundled lesson to show translated lesson text and aligned assessment options. Provider/custom content retains its source language.
4. **Facilitator:** inspect learner progress, assign a course, save a private follow-up note and open module authoring. Membership access and note privacy are checked automatically with separate accounts.
5. **Opportunities → Community & accounts:** show source links, document checklists and clearly labelled demonstrations. Inspect Team, Mentoring, Payments, Integrations and the owner Pilot board. Explain that real partner accounts require consenting participants and invitations; unconfigured checkout remains disabled.

For offline cold-start testing, use a production build with a local authenticated preview and **Settings → Prepare offline learning** while connected. Stop the server, reload, complete a cached lesson and reconnect to sync. Development HMR is not the production offline shell. See VERIFICATION.md for prior browser evidence and PILOT_RUNBOOK.md for physical-device checks.

## Technical delivery

| Area | Implementation |
| --- | --- |
| UI and runtime | React, TypeScript, Vinext/Vite, Cloudflare Worker |
| Persistence | D1/SQLite, Drizzle schema, four versioned migrations |
| Offline | Dexie/IndexedDB snapshot and outbox; service-worker shell cache; revision conflicts and idempotent replay |
| Identity | Trusted Sites identity; owner/teacher/student/mentor/employer permissions; expiring email-bound invitations |
| Guidance | Source retrieval with optional Cloudflare Workers AI or Ollama; labelled fallback |
| Opportunities | Official source directory, validated provider imports and consented employer intake |
| Payments | Razorpay hosted links/subscriptions; capture, refund and entitlement reconciliation |
| Quality | Unit/security/provider-contract tests, compiled Worker HTTP checks and GitHub Actions |

See [ARCHITECTURE.md](ARCHITECTURE.md), [public/openapi.json](public/openapi.json), [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [research](docs/EXISTING_SOLUTIONS_RESEARCH.md) for implementation and provenance. The dashboard screenshot was verified on 18 October 2026; the research and pilot screenshot are retained evidence from 17 October 2026.

## Remaining external validation

The functional submission is reviewable without provider secrets. Activating hosted AI, authorized feeds and Razorpay test checkout requires the corresponding account credentials. Merchant sandbox purchase/renewal/refund checks, real participant onboarding, microphone/regional speech checks and low-end Android testing require those external resources. These checks remain unclaimed on the Pilot board until evidence is recorded. See [INTEGRATIONS.md](INTEGRATIONS.md) and [PILOT_RUNBOOK.md](PILOT_RUNBOOK.md).

The existing hosted demo is owner-private. Repository access does not grant hosted Site access. A reviewer can run the complete local source using the commands above.
