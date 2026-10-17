# Third-party software and product references

Disha's domain workflows and teaching content are original. The application reuses these open-source foundations via package dependencies or the supplied starter:

| Component                                | Source                                      | Licence / role                                                                             |
| ---------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Vinext                                   | https://github.com/cloudflare/vinext        | MIT; full-stack routing and React runtime                                                  |
| React                                    | https://github.com/facebook/react           | MIT; user interface                                                                        |
| Drizzle ORM                              | https://github.com/drizzle-team/drizzle-orm | Apache-2.0; typed database schema and migrations                                           |
| Lucide                                   | https://github.com/lucide-icons/lucide      | ISC; icons                                                                                 |
| Zod                                      | https://github.com/colinhacks/zod           | MIT; server input validation                                                               |
| Dexie                                    | https://github.com/dexie/Dexie.js           | Apache-2.0; offline IndexedDB records and outbox                                           |
| MiniSearch                               | https://github.com/lucaong/minisearch       | MIT; local full-text catalogue retrieval                                                   |
| json-logic-js                            | https://github.com/jwadhams/json-logic-js   | MIT; deterministic eligibility rules                                                       |
| Supplied Sites starter and UI components | Installed Sites plugin starter              | Retained starter infrastructure; individual component/dependency notices remain applicable |

Product references, not copied implementations:

- Kolibri: https://github.com/learningequality/kolibri (MIT). Inspired offline learner/coach patterns; Disha does not embed Kolibri or claim its measured outcomes.
- iDreamCareer, Quest Alliance, Antarang, Haqdarshak, Buddy4Study, Mentor Together and Forage: inspiration from publicly described workflows only. No proprietary application code, curriculum, logos, or data scraped from these platforms.

Dependency package licences remain available in node_modules and the lockfile records the exact installed versions. Additional upstream code must retain its licence and attribution if imported later.

Prettier (MIT, https://github.com/prettier/prettier) formats the source as a development-only dependency.
