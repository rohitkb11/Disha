# Disha

A rural learning-to-livelihood PWA for the Citi challenge. Built with the supplied Vinext/Cloudflare starter and established open-source libraries. Kolibri is the main product reference; Disha is not a Kolibri fork. See THIRD_PARTY_NOTICES.md for actual reuse.

## Implemented

- Twelve explainable career pathways, eight original courses, sixteen lessons/assessments, career trials and a learning passport with JSON export/printing.
- English, Hindi and Marathi navigation, common screens/forms and all sixteen bundled lessons. Provider text, user-authored content, career descriptions and some dynamic errors/statuses retain their source language. Browser speech includes typed alternatives.
- D1 persistence, IndexedDB outbox, revision conflicts, replay protection and prepared offline shell.
- Independent owner, teacher, student, mentor and employer accounts. Email-bound invitations expire after 48 hours, are single-use and revocable. Server authorization scopes linked learners to their records; facilitator notes remain private.
- Centre selection, learner management, assignments, notes, module authoring and employer opportunity publishing.
- Consented applications to onboarded employers inside the centre, durable receipts, review decisions and withdrawal. External provider applications still happen on their websites; their checklists are self-reported.
- Onboarded mentor availability, session proposals, overlap protection, confirmation/cancellation/completion and participant conversations.
- Source-linked guidance using optional Cloudflare Workers AI or Ollama adapters and a clearly labelled retrieval fallback.
- Provider JSON import/refresh with provenance and freshness dates. Source reachability is distinct from verification of eligibility/vacancies. Nine official source/directory entries and two labelled demonstrations were bundled on 2026-10-17.
- Razorpay hosted payment links, one-time module access, 30-day centre passes, optional monthly subscriptions, provider reconciliation, signed webhooks and server-enforced entitlements. Checkout is disabled without credentials.
- Durable rate limits, audit records, bounded input and same-origin JSON writes. API reference: public/openapi.json.
- Owner pilot board with eleven evidence-backed acceptance checks, configuration-presence indicators, joined-account counts and JSON report download. Test outcomes are explicitly self-reported.
- One-time purchase refund reconciliation, capture verification and payment-time-based expiry. Refunded receipts cannot regain access through stale paid-event replay.

## Local setup

Requires Node 22.13+ (Node 24 supported), npm and Git. No Cloudflare account is needed for local D1 emulation.

    npm ci
    npm run build

For a **new local database only**, apply migrations in order:

    node --import ./scripts/sites-env.mjs node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_deep_zaran.sql
    node --import ./scripts/sites-env.mjs node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_overconfident_spyke.sql
    node --import ./scripts/sites-env.mjs node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_blue_punisher.sql
    node --import ./scripts/sites-env.mjs node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0003_crazy_green_goblin.sql
    npm run dev

Do not replay applied migrations. Hosted Sites deployments apply versioned migrations. Development sign-in is loopback-only and excluded from hosted builds.

If the Windows npm shim fails, invoke the real entrypoint:

    & 'C:\Program Files\nodejs\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' run dev

## Verification

    npm run typecheck
    npm test
    npm run build

Separate-account checks target the **local compiled Worker**:

    node --import ./scripts/sites-env.mjs node_modules/wrangler/bin/wrangler.js dev --config dist/server/wrangler.json --local --persist-to .wrangler/state --ip 127.0.0.1 --port 5174 --inspector-port 0
    npm run test:roles

This creates disposable `.test` identities locally. Never target hosted Sites with simulated identity headers. `npm run test:api` checks original profile/sync workflows against the development server on port 5173. See VERIFICATION.md for release evidence.

## Pilot activation

The existing [Disha site](https://disha-learning-pathways.buzzyrook128.chatgpt.site/) retains its owner-only audience. Centre membership does not bypass the Sites sign-in gate. The owner must grant intended pilot users site access separately, then use Community & accounts → Team for centre invitations. Learners/mentors link to existing profiles; teachers/employers do not need profile links.

INTEGRATIONS.md documents AI, payments and feeds. Real credentials, consenting mentors/employers and physical device tests remain external dependencies. No live transaction has been tested or charged. This is a functional hackathon implementation; production commerce operations and field validation remain pilot work.
