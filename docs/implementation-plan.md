# Vibe implementation plan

Prepared for review on November 14, 2026. Event notes record a November 15, 2026, 11 AM America/Phoenix deadline. Product requirements, architecture and evidence are in the other three Vibe documents.

## Review boundary

The user approved Milestone 1 application implementation on November 14, 2026. Deployment needs the chosen AWS account, region and allowance. Global tool installation needs approval. Configure credentials through ignored local files or provider consoles.

## Milestone 0 — configuration

- [x] Approve product and architecture for Milestone 1 implementation (user authorized November 14, 2026).
- [x] Confirm AWS account 851725603471 and us-east-2 with the user.
- [x] Verify STS identity and existing Monthly Budget $50 with configured notifications.
- [x] Audit all 84 text-model catalog entries returned for Ohio and query access metadata.
- [x] Test eight model IDs and select working DeepSeek V3.2 with MiniMax M2.5 fallback.
- [x] Run synthetic tool round trips and class-planning/ownership checks.
- [x] Confirm provider keys exist and project `.env` is ignored.
- [x] Verify Supermemory authenticated namespace read.
- [x] Verify TinyFish Search/Fetch and the Supermemory docs MCP.
- [x] Verify actual Lambda execution-role access through a successful live DeepSeek run and deployed concurrency limits.

Milestone 1 is implemented and deployed from `anish/implementation`; remaining verification is recorded below and in `STATUS.md`. Integration-specific checks live with the milestone that needs them. Catalog access and this user's credentials do not establish the permissions of the future Lambda roles.

## Milestone 1 — two browsers and a real response

Milestone 1 is deployed at https://d1ia555vbcj8k2.cloudfront.net in account 851725603471, us-east-2. Local checks passed TypeScript, five targeted tests, production build and strict CDK synthesis. Live API checks passed two independent Cognito accounts, party/invite joining, persistent messages, author-scoped send idempotency, a real DeepSeek reply persisted exactly once and rejection of reads after member removal. An explicit queue redelivery retained one reply. Failed outbox records recovered after the DynamoDB attribute-alias fix, with zero pending records at the checkpoint. Live WebSocket checks passed member subscription and rejected wildcard subscriptions, client publishing and removed-member subscriptions. Two independent browsers connected live, exchanged messages and displayed the same real @Vibe reply. Browser reload and mobile chat checks were deferred at the user’s request to conserve usage. Temporary test users and their fixture records were removed after verification. Test accounts were provisioned administratively, so inbox delivery and user-entered email confirmation codes remain unverified.

- [x] Scaffold `web/`, `backend/`, `infra/` and shared contracts. The Python research adapter follows in Milestone 3.
- [x] Lock dependencies and prepare environment templates with local values ignored.
- [x] CDK defines Milestone 1 identity, database, HTTP API, Events, agent queue, functions and hosting. Provider-secret access follows when those integrations use it.
- [ ] Sign up, confirm email, sign in and retain identity across parties.
- [x] Create/list parties and join through link/QR.
- [x] Persist and paginate messages with author-scoped idempotency.
- [x] Deliver live refresh signals and repair state on reconnect.
- [x] Mention @Vibe and persist a real DeepSeek reply with working/error states.
- [x] Outbox recovery and queue redelivery preserve one logical reply.

Acceptance requires two independent browsers in one party exchanging messages, receiving an AI reply, reloading history and rejecting non-member reads and subscriptions.

## Milestone 2 — memory

Implemented and deployed from `anish/implementation` with user authorization. TypeScript, 21 targeted backend tests, production build and CDK synthesis passed. Live checks covered learning, approved cross-party reuse, an immediate correction, canonical deletion and provider cleanup. A cleanup retry delay was fixed and verified through a targeted normal queue scenario. The entire multi-party script was not rerun after that focused fix. See `STATUS.md` for evidence, setup and Milestone 3 continuation.

- [x] Verify Supermemory add/search/replace/delete using isolated synthetic documents.
- [x] Manual private points, edits, deletion and sharing approval.
- [x] Automatic extraction of self-authored facts with visible candidates.
- [x] Version-aware sync to party, private and shared namespaces.
- [x] Memory panel with sources, expiry, correction and processing state.
- [x] Per-party shared preference control.
- [x] Retrieval filtered against current canonical records.
- [x] Tombstones and revision checks prevent stale jobs restoring deleted or corrected facts.
- [x] Retry per-document deletion failures, including still-processing documents, until provider cleanup is confirmed.
- [x] Bounded profile previews and owner Markdown export.

Acceptance requires learning in party A, approved reuse in party B and a correction governing the next answer. Test stale search, contradictory history and private source metadata.

## Milestone 3 — memory follow-ups, class and general research

This milestone includes the remaining memory improvements identified after Milestone 2. The deployed personal-memory flow is the starting point. Complete the memory follow-ups alongside the research integration and record their verification separately in `STATUS.md`.

### 3A — structured party memory

The current party-memory panel reads structured facts, but no application writer populates those records. Conversation indexing already provides a separate historical retrieval path.

- [ ] Add bounded extraction of party decisions, shared constraints, unresolved questions and relevant goal updates from attributed human conversation.
- [ ] Persist versioned `PARTY_FACT` records through the existing DynamoDB/outbox path and populate the party-memory panel. Include source message IDs, timestamps, speaker attribution and optional expiry.
- [ ] Distinguish suggestions, confirmed decisions and unresolved disagreements using the supporting conversation. Preserve uncertainty when agreement is missing.
- [ ] Let current members correct or remove party notes with optimistic version checks and visible provenance. Corrections must invalidate stale summaries and retrieved source spans.
- [ ] Deduplicate retries and repeated statements. A delayed extraction must preserve a newer member correction or deletion.
- [ ] Keep notes scoped to their party. Recheck source access when opening message links, including when another party has identical membership.

Acceptance requires a discussion that produces a visible sourced decision and an unresolved question, persistence across reload, a correction governing the next answer, and rejection of reads from a different party.

### 3B — broader automatic personal learning

The current extractor uses an English first-person filter and runs on an author's mention or ten pending messages from that author.

- [ ] Replace the English-pronoun gate with bounded extraction that recognizes self-descriptions and paraphrases. Cover English variants and at least one non-English or mixed-language example, and document the languages actually checked.
- [ ] Keep subject ownership bound to authenticated message authors and source IDs. Quoted text, third-party claims, agent replies and retrieved webpages must not establish another person's profile.
- [ ] On an @Vibe request, process eligible pending contributions from learning-enabled party members using bounded per-author jobs. Preserve continuation cursors when a batch exceeds the work budget.
- [ ] Preserve learning-off behavior, private candidate review, explicit sharing approval and per-party opt-in. Show pending extraction and failures where relevant in the memory UI.
- [ ] Separate durable personal preferences from trip-specific budgets, temporary availability and party decisions. Preserve party scope and expiry for temporary constraints.
- [ ] Consolidate repeated facts while retaining provenance. Protect owner edits and source-wide tombstones when extraction is retried or phrased differently.

Acceptance requires equivalent preferences expressed in different wording, one documented non-English or mixed-language example, contributions from two authors, and correct handling of a quotation, third-party claim and temporary constraint. Learning-off and stale-job correction/deletion cases must continue to pass.

### 3C — richer profiles and better memory selection

The current compact preview is rendered from canonical approved points. Supermemory profile buckets are available in the selected API but are not integrated into the UI.

- [ ] Integrate Supermemory profiles/buckets for compact owner-facing summaries, organized around useful categories such as academics, travel and communication.
- [ ] Display processing/freshness state and let the owner inspect the supporting canonical points. Keep previews bounded and retain the full points view and Markdown export.
- [ ] Invalidate cached previews when their input facts are corrected, deleted, expired or have approval revoked. Handle delayed provider summaries explicitly.
- [ ] Keep group-answer context limited to current, approved facts from opted-in members. Aggregate owner summaries can contain private facts, so validate their complete input set before any group reuse.
- [ ] Improve selection using semantic relevance, current canonical versions and important constraints. Retain the immediate-correction fallback during provider indexing delays.
- [ ] Handle conflicting preferences, expired constraints and oversized context explicitly. Request clarification or narrower scope when required information exceeds the context budget.
- [ ] Check retrieval across class planning, trip planning and hackathon brainstorming, including an older relevant fact outside the recent-chat window. Record omissions and observed limits.

Acceptance requires a concise owner preview that updates after an edit, private points staying outside group context, retrieval of an older relevant fact, and a correction governing the next answer despite stale provider results. Include conflicting and expired preferences in the focused checks.

### 3D — class and general research tools

- [ ] Inspect the Python environment, run its existing offline retrieval suite and one bounded ASU/RMP live smoke scenario.
- [ ] Record source revision, license/provenance and attribution for reused modules.
- [ ] Package approved SameClass modules behind typed IAM-invoked Python tools.
- [ ] Add the bounded agent tool loop, persist model tool requests before execution, validate arguments and preserve action IDs on retries.
- [ ] Search classes, inspect course details and resolve professor identities.
- [ ] Retrieve bounded reviews and syllabus evidence with historical labels.
- [ ] Deterministically compare normalized schedules and preserve unknowns.
- [ ] Connect TinyFish Search/Fetch with citation IDs and freshness metadata.
- [ ] Combine research evidence with current party constraints and permitted personal preferences. Keep retrieved instructions outside application authority.
- [ ] Display partial results and source failures.
- [ ] Add an asynchronous browser research job for a demonstrated interaction need.

Acceptance requires real class research and a sourced compatibility explanation for two students, plus a general trip or brainstorming question through the same app. The research flow must honor a corrected preference and current sharing settings.

### Delivery and verification

Start with the structured party-note write path and extraction ownership safeguards. Improve profiles/retrieval while integrating the research tools. Use focused regression checks for the specific failures above, then one bounded multi-party live scenario covering memory and research together. Record implemented work, observed behavior and remaining gaps in the status report. Recheck the final browser flow after fixes to close the verification gap carried from Milestone 2.

## Milestone 4 — contextual participation, background learning, plans and modes

### 4A — understand short replies using surrounding conversation

- [ ] Give extraction a bounded, chronologically ordered window containing the relevant proposal and surrounding messages from multiple speakers. Carry stable author IDs, message IDs, party ID, timestamps and available reply-to links. Start with the existing 40-message / 12,000-character context budget.
- [ ] Resolve short responses such as “That sounds fun, I’m in” against the specific activity or proposal they answer. Prefer explicit reply links; use nearby context only when the reference is unambiguous.
- [ ] Record participation as a party-scoped fact linking the participant’s own response to the proposal’s source messages. Preserve suggested, confirmed and unresolved states, plus corrections or withdrawal.
- [ ] Keep durable personal learning tied to evidence the subject authored about themselves. A one-time agreement to join an activity establishes participation in that plan; creating a reusable interest requires explicit durable evidence and the existing candidate/approval flow.
- [ ] Use other speakers’ messages to resolve context while preserving profile ownership. Respect learning controls, current membership, source access, correction versions and tombstones.
- [ ] When several proposals could fit, or the referenced proposal falls outside accessible context, retain an unresolved reference and surface the need for clarification. Keep task acceptance bound to the authenticated acceptance workflow and the actual task scope.

Acceptance requires a conversation where A proposes camping and B replies “I’m in,” producing a sourced participation record for B. Also check two competing proposals, an explicit reply to an older proposal, a quoted agreement, a withdrawal and a removed member. Personal memory should gain a camping preference only when B supplies explicit durable evidence and permits the corresponding learning/sharing steps.

### 4B — learn from quieter users without mentions

- [ ] Add a time-based trigger alongside mentions and message-count triggers. When a human message is saved, maintain a queryable per-party pending-work marker and per-author extraction cursors.
- [ ] As an initial configurable policy, make work eligible after two minutes of party inactivity and discover it on a five-minute scheduled tick. Reuse the recovery schedule where practical. Document the resulting scheduling delay separately from provider processing time.
- [ ] At the first eligible tick, enqueue bounded contextual extraction for pending contributions, including learning-enabled authors with fewer than ten messages. Include the surrounding conversation needed by 4A and retain continuation cursors for additional batches.
- [ ] Recheck each author’s learning setting, current membership and memory revision when the job starts and before candidate writes. Preserve the existing private-candidate, owner-approval and per-party sharing controls.
- [ ] Deduplicate timer, mention and message-count jobs against their covered source boundaries. A delayed job must preserve later edits, deletions and withdrawals. Schedule remaining work after a partial batch and stop scheduling when the backlog is drained.
- [ ] Bound background model work with a configurable initial limit of one timer-triggered batch per party per five minutes, the existing batch/context limits, metered-feature switch and persisted usage controls. Skip model calls for empty or already-covered work. Keep extraction silent in the chat while exposing processing/errors in the memory UI.

Acceptance requires an opted-in user to contribute two eligible statements, never tag @Vibe and remain below ten messages. After the configured idle period and scheduled tick, private candidates should appear. Check learning disabled, no new messages, duplicate ticks overlapping a mention, a multi-batch backlog, membership removal and a correction/deletion while work is queued. Record observed candidate latency and model-call counts.

### 4C — shared tasks, modes and email

- [ ] Persist proposed tasks and versioned edit proposals.
- [ ] Members accept, claim, decline and complete their own assignments.
- [ ] Material changes require renewed acceptance.
- [ ] Duplicate tool execution returns the recorded action result.
- [ ] Focused, Friendly and Banter tone settings.
- [ ] Application-sent email through SES when sender and delivery access are ready.

Acceptance requires task persistence after reload, participant acceptance and rejection of unauthorized state transitions. Complete the contextual participation and quiet-user background-learning acceptance scenarios above as part of this milestone.

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
