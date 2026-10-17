# Disha

A rural learning-to-livelihood PWA built for the Citi challenge. Students explore careers, try practical activities, learn through short modules, prepare applications and maintain a learning passport. Facilitators support multiple learners, keep notes, assign learning, author modules and add community partners.

## Features

- Twelve career directions, including creative, care, agricultural, technical and community roles.
- Explainable matching based on explicitly selected interests, with education bridges rather than exclusion of aspirational paths.
- Guided profile discovery through voice or text, followed by user review.
- Eight original starter courses, sixteen lessons, quizzes and a career activity for each direction.
- Six official program-directory links and two explicitly labelled demonstration opportunities.
- Application checklists, document-readiness tracking and self-reported statuses.
- Three labelled sample mentors, facilitator-added mentors and internal mentoring requests.
- Learner management, notes, assignments and original training-module publishing with listed pricing.
- English, Hindi and Marathi navigation; selected lessons translated into Hindi/Marathi.
- Browser voice input/output with typed alternatives and clear support limitations.
- Source-linked guide with a real server-side Ollama integration and an explicit retrieval fallback.
- Durable private workspaces in Cloudflare D1; IndexedDB outbox, conflict handling, offline shell preparation and install manifest.
- Learning passport export as JSON and browser printing.

## Requirements

Node.js 22.13 or newer; Node 24 is supported. npm and Git are required. A Cloudflare account is not required for local D1 emulation. Ollama is optional for generative guidance.

## Local setup

Run these commands from the project directory:

    npm ci
    npm run build
    node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_deep_zaran.sql
    npm run dev

Apply the SQL migration once to a new local database. Do not replay an applied migration. The database remains under `.wrangler/state`. Dev normally serves at http://127.0.0.1:5173; use the URL printed by the server.

The portable starter simulates sign-in on loopback. Choose “Open my learning space” to start. This development identity is never included in hosted builds. A new workspace starts with clearly labelled sample learners; use “Create my profile” for an original learner.

If a bundled Windows npm shim fails, invoke the installed npm JavaScript entrypoint using its actual absolute path, for example:

    & 'C:\Program Files\nodejs\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' run dev

## Local AI

Copy `.env.example` to the ignored `.dev.vars` file. Run Ollama and make the configured model available:

    ollama serve
    ollama pull qwen2.5:1.5b

Restart dev after changing runtime variables. The browser never receives the inference URL. The guide displays the actual response mode and links to retrieved sources. If inference fails, the catalogue fallback remains usable.

For hosting, configure a securely reachable inference service through runtime environment settings. The user's localhost is not reachable from a hosted Worker. Without that configuration, the hosted site uses catalogue guidance.

## Useful commands

    npm run typecheck
    npm test
    npm run test:api
    npm run build
    npm start

`test:api` expects the local development server at port 5173 and uses its local test identity. It creates a clearly named disposable QA learner. Set `DISHA_TEST_AI=1` to include inference. It is not a test command for the private production site.

## Offline demonstration

1. Sign in online, open a course, then use Settings → Prepare for offline.
2. Disconnect connectivity and reload the page.
3. Read a saved lesson and complete a quiz or activity. The edit remains queued on the device.
4. Reconnect and use Sync now. Reload and verify that progress remains.

New AI generation, external application sites and live provider information need connectivity. Missing regional device voices or unsupported speech recognition produce a typed fallback, not a silent failure.

## Scope and deployment boundaries

This is a substantial functional hackathon implementation, not a claim of a field-validated production service. The initial host is private to its owner. Facilitator and student screens share that owner's workspace; separate independently signed-in learner accounts, delegated roles, public enrollment and institutional membership are future extensions.

No real applications are submitted, mentor messages sent or payments charged. The interface identifies demonstration records, self-reported statuses and provider verification requirements. Course prices are recorded, but a payment gateway and commercial access controls are not connected.

Official directories are not a live aggregated vacancy or scholarship feed. Refresh catalogue records and verify provider requirements before a real pilot. Browser/device voice coverage and performance on actual low-end Android phones still require field testing.

See SPRINTS.md for phase acceptance gates, ARCHITECTURE.md for the data flow, and THIRD_PARTY_NOTICES.md for actual reuse and inspiration. Original application code uses the MIT licence; dependency licences remain applicable.
