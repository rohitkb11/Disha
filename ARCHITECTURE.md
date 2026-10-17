# Architecture

## Stack and reuse

The supplied Sites/Vinext starter provides React routing, Cloudflare Worker deployment, D1 integration and platform-managed identity. Drizzle defines the database schema. Dexie provides IndexedDB persistence. MiniSearch provides local source retrieval. json-logic-js evaluates the explicitly labelled sample eligibility rules. Lucide provides icons.

Kolibri is the main product reference for offline learning and teacher workflows. Disha is not a Kolibri fork and does not copy its curriculum. THIRD_PARTY_NOTICES.md distinguishes actual software dependencies from product inspiration.

## Request and data flow

1. The hosting platform authenticates a visitor and supplies trusted identity to the Worker. Local development simulates a single identity on loopback only.
2. `/api/state` derives the owner's workspace on the server. Request bodies cannot choose a different workspace.
3. Records in D1 are namespaced with the server-derived workspace ID. Browser-visible record IDs do not contain that namespace.
4. A browser edit writes an absolute record snapshot and an event to one Dexie transaction before updating the interface.
5. The outbox synchronizes online and retries later after network failures. Server revisions prevent stale updates from silently replacing newer work.
6. Replayed event IDs are acknowledged without applying them twice. A last-event field also handles a response or acknowledgement failure after a record write.
7. Conflicting drafts are retained in IndexedDB. The interface restores the canonical server version and exposes the draft for review in Settings.

The site owner can manage multiple learners in their own private workspace. Student and facilitator screens are views of that workspace, not separate independently authenticated teacher/student accounts. Cross-institution collaboration or delegated access would need explicit membership and roles.

## Data model

- `workspaces`: stable owner identity and display name.
- `records`: typed JSON snapshots for learners, progress, trials, applications, notes, assignments, modules, mentors and opportunities; each record has a revision.
- `processed_events`: idempotency acknowledgements scoped to a workspace.

Schema changes use versioned Drizzle migrations, never runtime table creation. Catalogue content is shipped with the application; custom modules and partner records are stored in D1.

## AI

`POST /api/guide` first authorizes the learner, retrieves relevant catalogue content through MiniSearch, and calls the configured Ollama chat endpoint with a bounded source-grounded prompt. Only necessary learning context is passed; names, income and contact details are omitted.

The response identifies whether an Ollama model or catalogue retrieval actually produced it. A model timeout does not masquerade as successful model inference. Source links are supplied alongside answers. Retrieval is not a guarantee that generated text is correct; eligibility and provider facts must be checked.

Local inference can run through the installed Ollama service. A hosted Worker cannot call the user's localhost. Hosted generative AI needs a securely reachable configured inference endpoint. No model credential or endpoint is embedded in browser code.

## Offline behavior

A service worker caches the application shell and same-origin code/style assets. The explicit preparation action also caches resources loaded before service-worker activation. API responses, authentication routes and user identity are not stored in the shared HTTP cache. User-owned snapshots and unsynced edits reside in IndexedDB.

An unlocked browser on a shared device can expose its local data. Sign-out clears IndexedDB after pending changes have been synchronized. Device-local data clearing is an explicit user action. Offline use requires an initial online visit and preparation.

Browser speech recognition and synthesis depend on browser, device voices, microphone permission and sometimes internet access. They are distinct from the application's offline data features. Some original starter lessons have Hindi/Marathi translations; others are explicitly labelled as English content.

## External systems

Official opportunities are program directories with provider links. No unverified automatic eligibility is assigned to them. Sample rules are deterministic and explicitly identified as demonstrations. Provider-supplied community entries are labelled separately.

Checklist statuses are self-reported. The application does not submit government or employer forms. Mentor requests are internal records; there is no external messaging. Module prices are recorded, with no payment collection until a gateway is integrated.

`public/openapi.json` documents the implemented JSON endpoints. `/api/catalog` provides the starter catalogue without user data.
