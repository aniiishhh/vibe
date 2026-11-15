# Vibe implementation plan

Prepared for review on November 14, 2026. Event notes record a November 15, 2026, 11 AM America/Phoenix deadline. Product requirements, architecture and evidence are in the other three Vibe documents.

## Review boundary

Begin application implementation after scope and architecture approval. Deployment needs the chosen AWS account, region and allowance. Global tool installation needs approval. Configure credentials through ignored local files or provider consoles.

## Milestone 0 — configuration

- [ ] Approve or revise product and architecture.
- [x] Confirm AWS account 851725603471 and us-east-2 with the user.
- [x] Verify STS identity and existing Monthly Budget $50 with configured notifications.
- [x] Audit all 84 text-model catalog entries returned for Ohio and query access metadata.
- [x] Test eight model IDs and select working DeepSeek V3.2 with MiniMax M2.5 fallback.
- [x] Run synthetic tool round trips and class-planning/ownership checks.
- [x] Confirm provider keys exist and project `.env` is ignored.
- [x] Verify Supermemory authenticated namespace read.
- [x] Verify TinyFish Search/Fetch and the Supermemory docs MCP.
- [ ] During deployment, verify the actual application execution roles and model quota.

This milestone is ready for implementation approval. Integration-specific checks live with the milestone that needs them. Catalog access and this user's credentials do not establish the permissions of the future Lambda roles.

## Milestone 1 — two browsers and a real response

- [ ] Scaffold `web/`, `backend/`, `research/`, `infra/` and shared contracts.
- [ ] Lock dependencies and prepare ignored environment templates.
- [ ] CDK defines identity, database, HTTP API, Events, queues, functions, secrets references and hosting.
- [ ] Sign up, confirm email, sign in and retain identity across parties.
- [ ] Create/list parties and join through link/QR.
- [ ] Persist and paginate messages with author-scoped idempotency.
- [ ] Deliver live refresh signals and repair state on reconnect.
- [ ] Mention @Vibe and persist a real DeepSeek reply with working/error states.
- [ ] Outbox recovery and queue redelivery preserve one logical reply.

Acceptance requires two independent browsers in one party exchanging messages, receiving an AI reply, reloading history and rejecting non-member reads and subscriptions.

## Milestone 2 — memory

- [ ] Verify Supermemory add/search/replace/delete using isolated synthetic documents.
- [ ] Manual private points, edits, deletion and sharing approval.
- [ ] Automatic extraction of self-authored facts with visible candidates.
- [ ] Version-aware sync to party, private and shared namespaces.
- [ ] Memory panel with sources, expiry, correction and processing state.
- [ ] Per-party shared preference control.
- [ ] Retrieval filtered against current canonical records.
- [ ] Tombstones and revision checks prevent stale jobs restoring deleted or corrected facts.
- [ ] Retry per-document deletion failures, including still-processing documents, until provider cleanup is confirmed.
- [ ] Bounded profile previews and owner Markdown export.

Acceptance requires learning in party A, approved reuse in party B and a correction governing the next answer. Test stale search, contradictory history and private source metadata.

## Milestone 3 — class and general research

- [ ] Inspect the Python environment, run its existing offline retrieval suite and one bounded ASU/RMP live smoke scenario.
- [ ] Record source revision, license/provenance and attribution for reused modules.
- [ ] Package approved SameClass modules behind typed IAM-invoked Python tools.
- [ ] Search classes, inspect course details and resolve professor identities.
- [ ] Retrieve bounded reviews and syllabus evidence with historical labels.
- [ ] Deterministically compare normalized schedules and preserve unknowns.
- [ ] Connect TinyFish Search/Fetch with citation IDs and freshness metadata.
- [ ] Display partial results and source failures.
- [ ] Add an asynchronous browser research job for a demonstrated interaction need.

Acceptance requires real class research and a sourced compatibility explanation for two students, plus a general trip or brainstorming question through the same app.

## Milestone 4 — plans and modes

- [ ] Persist proposed tasks and versioned edit proposals.
- [ ] Members accept, claim, decline and complete their own assignments.
- [ ] Material changes require renewed acceptance.
- [ ] Duplicate tool execution returns the recorded action result.
- [ ] Focused, Friendly and Banter tone settings.
- [ ] Application-sent email through SES when sender and delivery access are ready.

Acceptance requires task persistence after reload, participant acceptance and rejection of unauthorized state transitions.

## Milestone 5 — demonstration and submission

- [ ] Mobile QR, conversation, memory and plan flows.
- [ ] Real-device test on the deployed URL.
- [ ] Measure latency, attribution, corrections, isolation, actions and usage.
- [ ] Record actual model tokens, memory ingestion and browser steps.
- [ ] Public README with setup, architecture, AI assistance and source attribution.
- [ ] Prepare Devpost write-up and optional video for team review.
- [ ] Submit after explicit team authorization.

## Delivery order and checks

The first usable checkpoint is Milestone 1. Memory and course research form the distinguishing demo. Task actions follow those paths. Link/QR invitations work before the email-delivery integration. Token streaming and proactive contributions can follow the first completed-response experience.

| Failure scenario | Required behavior |
| --- | --- |
| Duplicate send or redelivery | One logical message, reply and action |
| Crash after commit | Outbox recovers the pending effect |
| Removed member with open socket | Subsequent content reads fail authorization |
| Third-party preference claim | Another person's profile is unchanged |
| Correction with stale retrieval | Canonical current value governs |
| Delayed extraction | Newer user edit is preserved |
| Shared fact from private party | Only permitted fact text and attribution are disclosed |
| Ambiguous professor or missing syllabus | Uncertainty is visible and independent evidence retained |
| Unknown meeting | Compatibility remains unverified |
| Reply fails after task creation | Persisted task is visible and retries preserve its ID |
| Webpage prompt injection | Retrieved text cannot grant action permissions |
| Provider deletion partially fails | Canonical deletion takes effect immediately and cleanup remains pending until retried |

Use targeted Vitest checks for these state and permission failures, the existing pytest suite for retrieval contracts, and Playwright for independent-user browser flows.
