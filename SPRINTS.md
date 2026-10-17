# Disha build sprints

Working scope: a mobile PWA connecting rural students with career exploration, practical learning, verified information and facilitator support. English, Hindi and Marathi form the first language pack.

| Sprint | Deliverable                                                                                        | Acceptance gate                                                       | Status                     |
| ------ | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------- |
| 1      | Full-stack foundation, durable data, signed-in workspaces, starter catalogues, licence inventory   | Database migrations and authenticated API work                        | Complete locally           |
| 2      | Editable profiles, explainable career matching, conversational guide                               | Profile changes alter recommendations; guidance cites sources         | Complete locally           |
| 3      | Learning pathways, lessons, quizzes and practical career trials                                    | Progress and scored work persist after reload                         | Complete locally           |
| 4      | Opportunity discovery, eligibility, application checklists                                         | Missing information is distinguished from eligibility; drafts persist | Complete locally           |
| 5      | Facilitator workspace, student management, notes, assignments, mentor requests and module creation | Teacher actions update the selected student and stored records        | Complete locally           |
| 6      | Language packs, voice, installation and offline synchronization                                    | Offline actions survive reload and sync idempotently                  | Complete locally           |
| 7      | Security and functional checks, browser QA, documentation and deployment                           | Type checks, domain tests, API and browser workflows pass             | Verification and packaging |

## References and reuse

Kolibri is the primary product reference for learner/coach workflows and offline content. Career exploration follows the documented patterns of iDreamCareer, Quest and Antarang. Haqdarshak inspires supported applications. Forage inspires short original career trials. Proprietary code and learning content are not copied.

Reuse the supplied Vinext/Cloudflare starter, its authentication and database bindings, open-source UI components, and installed libraries instead of reimplementing those foundations. See THIRD_PARTY_NOTICES.md for actual dependencies and attribution.

## Honest integration boundaries

- Real official program links are distinct from clearly labelled demonstration listings.
- Application preparation and local tracking do not submit to government/employer systems.
- Real generative guidance uses the server's configured Ollama service; retrieval-based guidance remains usable without a model and identifies its mode.
- Browser speech features depend on device/language support and are not advertised as guaranteed offline recognition.
- Paid-module pricing is saved; real payment collection requires a payment provider and credentials.
- Private hosted access uses Sites authentication. Workspaces and all learner records are authorized server-side.

## Verification record

- Local D1 migration applied successfully.
- TypeScript checks and nine domain tests passed.
- HTTP checks passed: unauthenticated and spoofed identities rejected, origin checks, input validation, durable snapshots, replay idempotency, stale-revision protection.
- Real local Ollama inference returned an answer with four source references.
- Browser checks passed: lesson assessment and reload persistence, unknown eligibility, saved application checklist, facilitator notes and assignments, original module publishing.
- Production asset manifest added after the development offline test exposed incomplete module caching. The production offline reload/recovery check passed: cold reload, completing a lesson without the server, retained progress after another reload, and synchronization after reconnection.

- Browser checks also verified Hindi and Marathi lesson translations and a complete six-question profile interview with an editable review. Actual microphone/device-voice and physical low-end Android testing remain device-dependent.
