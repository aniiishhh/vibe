# Vibe implementation plan

Prepared for review on November 14, 2026. Event notes record a November 15, 2026, 11 AM America/Phoenix deadline. Product requirements, architecture and evidence are in the other three Vibe documents.

## Review boundary

The user approved Milestone 1 application implementation on November 14, 2026. Deployment needs the chosen AWS account, region and allowance. Global tool installation needs approval. Configure credentials through ignored local files or provider consoles.

## November 15 handoff status

**Milestone 3 is implemented and deployed** to the shared account. The user authorized deployment/completion on November 15. The remaining 3B flow passed 25 focused memory checks and a bounded two-user live Haiku acceptance scenario, alongside TinyFish general research and ASU class research. The detailed Milestone 4A/4B/4C plan from Anish's `3e25592` is preserved below.

| Part | Implementation | Verification / remaining work |
| --- | --- | --- |
| 3A party memory | Implemented and deployed | Earlier two-user/browser checks passed; latest Haiku behavior remains for manual retesting. |
| 3B broader personal learning | Implemented and deployed | 25 focused checks, typechecks, build and bounded live English/Spanish learning, ownership, exclusions, consolidation and correction checks passed. |
| 3C owner profiles and memory selection | Implemented and deployed | Canonical/privacy/correction checks passed; derived provider prose remains withheld when unverifiable, broad semantic quality remains unevaluated. |
| 3D research | Implemented and deployed | Class/RMP/web source probes and focused regressions passed; latest expanded filters/syllabus/review behavior awaits manual acceptance. Interactive TinyAgent work is conditional on a demonstrated need. |

Current app: https://d1ia555vbcj8k2.cloudfront.net, shared account 851725603471, Ohio, Haiku 4.5. Earlier 56 backend / 10 adapter checks plus the 25 focused 3B checks, typechecks, production build and strict synthesis passed. The authorized completion check exercised two users and two research requests. See the completion report for observed coverage. See [handoff](milestone-3-handoff.md) and [current status](../STATUS.md).

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

Originally verified in Bhavesh’s private account (`782610231983`, Ohio); now also deployed to the shared account `851725603471` with Haiku. The private checkpoint is retained separately. The original 3A live scenario passed; the November 15 user-reported preference/concurrency cases are now fixed and have passed the memory portion of the combined verification. Final research/browser application assertions passed; fixture cleanup required scoped recovery. See `STATUS.md` for current deployment and checks.

- [x] Implement bounded mention-triggered extraction (up to twenty recent messages; model quality checked in one live synthetic scenario) of party decisions, shared constraints, unresolved questions and relevant goal updates from attributed human conversation.
- [x] Persist versioned `PARTY_FACT` records through the existing DynamoDB/outbox path and populate the party-memory panel. Include source message IDs, timestamps, speaker attribution and optional expiry.
- [x] Distinguish suggestions, confirmed decisions and unresolved disagreements using the supporting conversation (confirmed decision/question live scenario passed; broader disagreement quality still needs evaluation). Preserve uncertainty when agreement is missing.
- [x] Let preference owners, manual-note authors and the party owner for automatic shared notes correct or remove their respective notes with optimistic version checks and visible provenance. Corrections must invalidate stale summaries and retrieved source spans.
- [x] Deduplicate retries and exact normalized shared statements; merge party-scoped preferences by authenticated author/topic with bounded model summaries and provenance. Broader shared-note paraphrase consolidation remains pending. A delayed extraction must preserve a newer member correction or deletion.
- [x] Keep notes scoped to their party. Recheck source access when opening message links, including when another party has identical membership.

Acceptance requires a discussion that produces a visible sourced decision and an unresolved question, persistence across reload, a correction governing the next answer, and rejection of reads from a different party.

### 3B — broader automatic personal learning

Implemented and deployed on November 15. The English-pronoun gate is removed. Every mention fans out in ten-member pages to separate current learning-enabled authors. Author windows contain at most twenty messages / 12,000 source-text characters; scan jobs examine at most 300 rows and continue sparse scans with bounded source-ID carryover. Cursors and remaining-work outbox records commit atomically. Automatic learning increments preserve the owner-change barrier, so continuation survives candidate creation while owner changes suppress stale evidence.

- [x] Replace the English-pronoun gate with bounded extraction for self-descriptions and paraphrases. English variants, Spanish and mixed Hindi/English have mocked-provider input/prompt coverage. English pronoun-free and Spanish examples also passed the live Haiku check. Mixed Hindi/English has fixture-only coverage.
- [x] Bind profile subjects and source IDs to authenticated authors. Each model call receives one author's human messages. Prompts exclude quotations, third-party claims, agent replies and retrieved text as personal evidence; canonical writes validate source ownership again.
- [x] Process eligible pending contributions from learning-enabled party members on @Vibe mentions, with bounded per-author jobs, paginated membership discovery and continuation cursors. This also works when the mentioning author has learning disabled.
- [x] Preserve learning-off, candidate review, approval and party opt-in. Show pending extraction, processing and failure state in the owner memory screen.
- [x] Explicitly classify durable personal evidence separately from temporary availability, one-trip budgets and party decisions in extraction instructions. Temporary constraints stay in party notes, with expiry when the source supplies a definite end.
- [x] Consolidate equivalent evidence against the newest forty active points. Merge same-party provenance under revision/version checks while preserving owner text and approval. Keep new-party/overflow evidence separately sourced. Tombstones suppress paraphrased retries from deleted/edited sources.

Verification used 25 focused memory checks plus workspace typechecks and the production web build. Checks cover two-author routing, non-English input transport, member pagination, sparse scans, continuation after candidate creation, input bounds, failures, learning-off, removed authors, source ownership, consolidation and stale correction/tombstone behavior. The subsequent bounded live Haiku scenario passed English/Spanish extraction, quotation/third-party/one-trip exclusions, two-author source isolation, equivalent-preference consolidation, correction/profile isolation, general TinyFish research and ASU class research. These specific examples satisfy the remaining bounded milestone acceptance. Broader language/recommendation-quality evaluation remains unmeasured. See results/milestone-3-completion-2026-11-15.md.


### 3C — richer profiles and better memory selection

Implemented owner-only categorized canonical previews plus filtered Supermemory bucket/profile reads, freshness states and supporting points. Provider abstractions with unverifiable inputs are withheld, so the preview stays canonical during indexing delays. Group context never consumes aggregate private summaries. Backend checks include old canonical relevance across class/trip/hackathon queries, private/expired exclusion, conflicting constraint preservation and oversized scope rejection. The combined live owner-preview isolation/edit check has passed; final application assertions passed; cleanup recovery is documented in STATUS.md.

- [x] Integrate Supermemory profiles/buckets for compact owner-facing summaries, organized around useful categories such as academics, travel and communication.
- [x] Display processing/freshness state and let the owner inspect the supporting canonical points. Keep previews bounded and retain the full points view and Markdown export.
- [x] Invalidate cached previews when their input facts are corrected, deleted, expired or have approval revoked. Handle delayed provider summaries explicitly.
- [x] Keep group-answer context limited to current, approved facts from opted-in members. Aggregate owner summaries can contain private facts, so validate their complete input set before any group reuse.
- [x] Improve selection using semantic relevance, current canonical versions and important constraints. Retain the immediate-correction fallback during provider indexing delays.
- [x] Handle conflicting preferences, expired constraints and oversized context explicitly. Request clarification or narrower scope when required information exceeds the context budget.
- [x] Check retrieval across class planning, trip planning and hackathon brainstorming, including an older relevant canonical fact outside the recent-chat window. Focused mocked-provider checks passed; broad live semantic ranking quality remains unevaluated.

Acceptance requires a concise owner preview that updates after an edit, private points staying outside group context, retrieval of an older relevant fact, and a correction governing the next answer despite stale provider results. Include conflicting and expired preferences in the focused checks.

### 3D — class and general research tools

Implemented and deployed; final combined live application assertions passed; cleanup recovery is documented in STATUS.md. ASU lookup, RMP source resolution/reviews and TinyFish Search/Fetch have passed bounded source probes. Public syllabus lookup returned not_found for the checked offering; successful syllabus text extraction is not claimed.

- [x] Inspect the Python environment, run its existing offline retrieval suite and one bounded ASU/RMP live smoke scenario.
- [x] Record source revision, license/provenance and attribution for reused modules.
- [x] Package approved SameClass modules behind typed IAM-invoked Python tools.
- [x] Add the bounded agent tool loop, persist model tool requests before execution, validate arguments and preserve action IDs on retries.
- [x] Search classes, inspect course details and resolve professor identities. Follow-up adds real level/keyword discovery, course deduplication and malformed tool-markup rejection; Haiku/team-account deployment completed; behavior will be manually evaluated by the user. Class search/discovery expose allowlisted keywords, instructor names, campus/delivery, days/dates, session, units/college and open/honors filters. Course tools accept semester names/year with deterministic ASU-code conversion; the agent asks for a semester/year only when missing or ambiguous.
- [x] Retrieve bounded general/course-specific reviews with pagination, sample metrics and separate overall ratings; restore automatic multi-term same/different-professor syllabus fallback with source labels. Professor questions are scoped to the current request; review retrieval prioritizes a supplied course code and explicitly distinguishes other-course samples and overall metrics.
- [x] Deterministically compare normalized schedules and preserve unknowns.
- [x] Connect TinyFish Search/Fetch with citation IDs and freshness metadata.
- [x] Combine research evidence with current party constraints and permitted personal preferences. Keep retrieved instructions outside application authority.
- [x] Display partial results and source failures.
- [ ] Conditional follow-up: add an asynchronous browser research job when a source demonstrates an interaction need. Current tested sources work through Search/Fetch and typed retrieval; no browser interaction requirement has been observed.

Acceptance requires real class research and a sourced compatibility explanation for two students, plus a general trip or brainstorming question through the same app. The earlier integrated source/browser checkpoint passed on the prior model; the completion scenario also passed shared Haiku ASU class and general TinyFish citation checks. Expanded syllabus/filter/review quality retains the focused fixture/source coverage documented in the earlier reports. The research flow must honor a corrected preference and current sharing settings.

### Delivery and verification

Start with the structured party-note write path and extraction ownership safeguards. Improve profiles/retrieval while integrating the research tools. Use focused regression checks for the specific failures above, then one bounded multi-party live scenario covering memory and research together. Record implemented work, observed behavior and remaining gaps in the status report. Recheck the final browser flow after fixes to close the verification gap carried from Milestone 2.

## Milestone 4 — contextual participation, background learning, plans and modes

Implemented and deployed on November 15 with user authorization. 77 backend tests, typechecks, production build and strict synthesis passed. The live two-user scenario passed contextual camping agreement/withdrawal, quiet private learning without mentions, task proposals and versioned self-actions, all modes, a real sandbox SES invitation and desktop controls. See [completion evidence](results/milestone-4-completion-2026-11-15.md). Arbitrary-recipient email requires SES production access; sandbox eligibility is shown by the app.

### 4A — understand short replies using surrounding conversation

- [x] Give extraction a bounded, chronologically ordered window containing the relevant proposal and surrounding messages from multiple speakers. Carry stable author IDs, message IDs, party ID, timestamps and available reply-to links. Start with the existing 40-message / 12,000-character context budget.
- [x] Resolve short responses such as “That sounds fun, I’m in” against the specific activity or proposal they answer. Prefer explicit reply links; use nearby context only when the reference is unambiguous.
- [x] Record participation as a party-scoped fact linking the participant’s own response to the proposal’s source messages. Preserve suggested, confirmed and unresolved states, plus corrections or withdrawal.
- [x] Keep durable personal learning tied to evidence the subject authored about themselves. A one-time agreement to join an activity establishes participation in that plan; creating a reusable interest requires explicit durable evidence and the existing candidate/approval flow.
- [x] Use other speakers’ messages to resolve context while preserving profile ownership. Respect learning controls, current membership, source access, correction versions and tombstones.
- [x] When several proposals could fit, or the referenced proposal falls outside accessible context, retain an unresolved reference and surface the need for clarification. Keep task acceptance bound to the authenticated acceptance workflow and the actual task scope.

Acceptance requires a conversation where A proposes camping and B replies “I’m in,” producing a sourced participation record for B. Also check two competing proposals, an explicit reply to an older proposal, a quoted agreement, a withdrawal and a removed member. Personal memory should gain a camping preference only when B supplies explicit durable evidence and permits the corresponding learning/sharing steps.

### 4B — learn from quieter users without mentions

- [x] Add a time-based trigger alongside mentions and message-count triggers. When a human message is saved, maintain a queryable per-party pending-work marker and per-author extraction cursors.
- [x] As an initial configurable policy, make work eligible after two minutes of party inactivity and discover it on a five-minute scheduled tick. Reuse the recovery schedule where practical. Document the resulting scheduling delay separately from provider processing time.
- [x] At each eligible tick, enqueue one bounded contextual extraction batch, processing one pending learning-enabled author, including authors with fewer than ten messages, plus shared contextual notes. Additional authors/backlog remain pending for later ticks. Include the surrounding conversation needed by 4A and retain continuation cursors for additional batches.
- [x] Recheck each author’s learning setting, current membership and memory revision when the job starts and before candidate writes. Preserve the existing private-candidate, owner-approval and per-party sharing controls.
- [x] Deduplicate timer, mention and message-count jobs against their covered source boundaries. A delayed job must preserve later edits, deletions and withdrawals. Schedule remaining work after a partial batch and stop scheduling when the backlog is drained.
- [x] Bound background model work with a configurable initial limit of one timer-triggered batch per party per five minutes, the existing batch/context limits, metered-feature switch and persisted usage controls. Skip model calls for empty or already-covered work. Keep extraction silent in the chat while exposing processing/errors in the memory UI.

Acceptance requires an opted-in user to contribute two eligible statements, never tag @Vibe and remain below ten messages. After the configured idle period and scheduled tick, private candidates should appear. Check learning disabled, no new messages, duplicate ticks overlapping a mention, a multi-batch backlog, membership removal and a correction/deletion while work is queued. Observed quiet-candidate latency was 141 seconds after an explicitly invoked scheduled-handler pass following the actual idle threshold. The batch made two successful model requests, using 3,388 input and 507 output tokens. The enabled five-minute schedule normally adds discovery delay, yielding approximately two to seven minutes plus queue/provider processing.

### 4C — shared tasks, modes and email

- [x] Persist proposed tasks and versioned edit proposals.
- [x] Members accept, claim, decline and complete their own assignments.
- [x] Material changes require renewed acceptance.
- [x] Duplicate tool execution returns the recorded action result.
- [x] Focused, Friendly and Banter tone settings.
- [x] Application-sent email through SES with the verified sender, availability/sandbox feedback and idempotent recorded results. A real mailbox-simulator send passed. Arbitrary-recipient production delivery awaits AWS approval outside the current sandbox configuration.

Acceptance requires task persistence after reload, participant acceptance and rejection of unauthorized state transitions. Complete the contextual participation and quiet-user background-learning acceptance scenarios above as part of this milestone.

## Milestone 5 — demonstration and submission

On November 15 the user authorized UI integration/deployment and a professional README with website images and the supplied AWS diagram. That requested scope is complete. Other Milestone 5 tasks remain deferred under the user's instruction. See [UI integration evidence](results/milestone-5-ui-integration-2026-11-15.md).

### Requested scope

- [x] Integrate the existing `anish/ui` revision `5971cd76de3f6c0c72e6f81975da962017e64754`, preserving its theme, mascot, automatic title/goal backdrops, mentions and interactions. Reconcile current memory/research, reply links, participation, tasks, modes, email availability and approval controls. Deploy and run bounded live UI checks.
- [x] Remove demonstration-only fixtures, simulated replies/run timers, mock sign-in, preview switches and the mascot playground. Real party names/goals feed the automatic background and mascot theme.
- [x] Add a professional README covering the product, features, privacy/consent, architecture, setup, deployment, repository layout and attribution. Include four actual-app screenshots and the supplied original AWS diagram under `docs/assets/`.
- [x] Make reviewable checkpoint commits and push to `anish/implementation`. Record deployed state, focused checks and cleanup in STATUS.md.

### Deferred under the user's instruction

- [ ] Full mobile QR, conversation, memory and plan acceptance flows beyond the bounded UI integration check.
- [ ] Real-device test on the deployed URL.
- [ ] Broad latency, attribution, corrections, isolation, action and usage measurements.
- [ ] Complete model-token, memory-ingestion and browser-step accounting.
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
