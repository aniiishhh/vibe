# Vibe status and teammate handoff

Updated November 15, 2026, America/Phoenix. Handoff target: `anish/implementation`.

## Milestone state

**Milestone 3 is implemented and deployed** on the shared app from `anish/implementation`. The user authorized completion and deployment on November 15. A bounded two-user live Haiku scenario passed the remaining 3B acceptance checks, general TinyFish research and ASU class research. Milestone 4A/4B/4C is the next implementation work. See [the completion report](docs/results/milestone-3-completion-2026-11-15.md) for exact coverage and limits.

### November 15 Milestone 3 completion

- Removed the English-pronoun prefilter. Bounded author-only model input handles self-descriptions and paraphrases, with explicit quotation, third-party and temporary-constraint exclusions.
- Every @Vibe mention creates paginated personal-extraction work for current learning-enabled members, including when the mentioning member has learning disabled. Fanout pages contain at most ten members. Each author gets a separate job and source window.
- Scans examine at most 300 chat rows per job and carry sparse pending sources forward. Extraction takes at most twenty own messages and 12,000 source-text characters, with up to five facts and the existing bounded two-attempt model call. Count-triggered jobs retain the ten-message threshold. Cursor advancement and remaining-work outbox writes commit together.
- Added an owner-change revision barrier. Automatic candidate creation can advance revisions without losing the rest of a backlog. Owner edits, deletion and learning-setting changes move the barrier, preserving stale-job protection. Existing profiles use a conservative baseline until their next owner change or candidate creation.
- Equivalent facts can consolidate same-party source IDs while retaining the owner's text, approval and fact version. Merging is conditional on the profile revision and fact version. Source tombstones still suppress paraphrased retries. New-party evidence remains a separate sourced candidate because the current fact contract has one source party. Consolidation considers the newest forty active points and preserves overflow evidence as separate candidates.
- The owner memory API/screen exposes pending, processing and extraction-error state and refreshes while work is pending. Temporary budgets/availability stay in party notes with expiry when the source supplies a definite end. Quiet-user idle scheduling and contextual participation remain Milestone 4 work.
- **25 focused memory tests passed**, workspace TypeScript checks passed and the production web build passed. Existing bundle-size advisory remains. English variants, Spanish and mixed Hindi/English reached isolated model input in mocked-provider fixtures. These checks verify routing, prompts, bounds, sources and state behavior. The subsequent live Haiku scenario passed English pronoun-free and Spanish extraction, two-author ownership, quotation/third-party/temporary exclusions, equivalent-meaning consolidation and canonical correction/profile isolation. Mixed Hindi/English retains fixture-only coverage.
- Deployed API, dispatcher, memory, agent and rebuilt research packages plus frontend assets. Strict synthesis and CDK diff passed. The stack reached UPDATE_COMPLETE after the 10:54 UTC deployment, and all five functions were Active/Successful. The public app and updated JavaScript asset returned HTTP 200. Existing resources and configuration serve this update. Replicate setup using the instructions below.

Completion cleanup succeeded. Both temporary Cognito users, 87 canonical fixture records and all fixture Supermemory namespaces were removed after the in-flight-write wait. Detailed evidence and deployment replication steps are in the completion report.

| Part | Current state |
| --- | --- |
| 1 and 2 | Implemented/deployed; earlier acceptance and limitations are retained in the historical reports. |
| 3A party memory | Implemented/deployed: sourced shared notes, named author/topic preferences, owner/author controls, corrections, tombstones and context guards. |
| 3B broader personal learning | Implemented/deployed. Focused checks and bounded live English/Spanish learning, ownership, consolidation and correction scenario passed. |
| 3C profiles/retrieval | Implemented/deployed: owner-only categorized canonical previews, provider freshness, validated shared retrieval and correction fallback. Unverifiable provider prose is withheld. |
| 3D research | Implemented/deployed: bounded ASU/RMP/syllabus/TinyFish tools, native Haiku tool loop, citations, schedule comparison and source/coverage labels. Latest shared Haiku ASU class lookup and general TinyFish citation checks passed. Broad recommendation-quality evaluation remains outside the bounded check. |
| 4 | Planned, not implemented. Anish's 3e25592 plan for 4A contextual participation, 4B quiet-user background learning and 4C tasks/modes/email is preserved. |

Read [the handoff](docs/milestone-3-handoff.md) and [implementation plan](docs/implementation-plan.md) before continuing. The deployed 3B extractor/cursor changes provide the starting point for 4A/4B.

## Current shared deployment

**https://d1ia555vbcj8k2.cloudfront.net** — stack `Vibe-dev`, account **851725603471**, **us-east-2**, **UPDATE_COMPLETE**. Latest deployment updated API/dispatcher/memory/agent/research packages and frontend assets. All five functions are Active/Successful. Agent and memory workers use **us.anthropic.claude-haiku-4-5-20251001-v1:0**. Different-model fallback is disabled for evaluation. Anthropic first-use setup and a real READY invocation succeeded before the shared model switch.

| Setting | Value |
| --- | --- |
| API Gateway | https://b8cojfsw6f.execute-api.us-east-2.amazonaws.com/api |
| Cognito pool | us-east-2_zrHcAFg7r |
| Cognito public client | 2q4vsdoqv1037okr9s3ivm8lim |
| Events HTTP | https://ged5txwgabfzpcqjmkazypa5s4.appsync-api.us-east-2.amazonaws.com/event |
| Events realtime | wss://ged5txwgabfzpcqjmkazypa5s4.appsync-realtime-api.us-east-2.amazonaws.com/event/realtime |
| DynamoDB table | vibe-dev |
| FIFO queues | vibe-dev-agent.fifo / vibe-dev-memory.fifo in this account |
| Research Lambda | vibe-dev-research, Python 3.12 x86_64, IAM invocation only |
| Provider credentials | SSM SecureStrings /vibe/dev/supermemory-api-key and /vibe/dev/tinyfish-api-key |

Bhavesh's local AWS profile `vibe-team` is IAM user bhavesh; its VibeDeployers group currently has AdministratorAccess and SignInLocalDevelopmentAccess. On another machine use the developer's own authorized profile and verify STS account before AWS mutations. The earlier scoped policy example in docs/aws/ is not required while admin access is effective. Runtime roles independently use scoped permissions, including the Haiku profile and its verified US destination-model ARNs.

The existing **Monthly Budget $50** was confirmed; it notifies rather than enforcing a hard cap and includes other account workloads. Provider billing is separate. Actual costs have not been measured. Preserve existing provider values; no keys belong in Git or frontend configuration.

## Delivered follow-ups

- Background party-note additions no longer invalidate every running answer. Manual corrections/deletion, current membership/sharing, canonical versions and historical-answer guards remain enforced.
- Latest request is pinned separately from party goals/history. Retrieval begins with that request and short earlier human context, excluding assistant recaps. Named professor/course questions should remain focused on the requested assessment.
- ASU search supports keywords/instructor names without a catalog number, plus level/campus/delivery/session/days/dates/units/college/open/honors filters. Numeric ASU semester codes stay internal; names/year are normalized deterministically.
- Syllabi rank requested-term/same-professor evidence, six earlier terms for that professor, then labelled other-professor evidence, under a 60-second budget. Source-term links, page excerpts and historical/different-instructor/partial flags remain explicit.
- RMP general professor metrics and course-specific review samples are separate. Cursor pagination and bounded sample metrics are available; a missing course in the sample does not establish no reviews exist. Textual tool markup cannot be published as a finished recommendation. Duplicate warnings are removed.

## Final verification and limits

**56 backend tests and 10 adapter tests passed** before the teammate handoff. The 3B update passed **25 focused memory checks**, workspace typechecks, production build and strict CDK synthesis. A subsequent authorized two-user live Haiku scenario passed the checks recorded in the completion report. Diff/whitespace checks passed. The existing frontend bundle-size advisory remains. Planned source/docs were scanned for credential patterns; no provider keys, AWS access IDs or private-key blocks were found. Ignored secrets, generated wheels, CDK output and browser credentials are excluded. The unrelated `output/imagegen/vibe-devpost-thumbnail.png` is preserved locally and excluded from this handoff.

Earlier private-account multi-user/browser/source assertions passed, with cleanup recovery documented. The November 15 completion check used two temporary shared-account users and two @Vibe requests. It passed pronoun-free English and Spanish private learning, quote/third-party/one-trip exclusions, source ownership, equivalent-fact provenance consolidation, corrected owner previews, real TinyFish general research and sourced ASU class research. It produced two and three initial candidates for the respective users. The public frontend asset includes the new extraction-state UI. This check covers specific observed examples. Broad recommendation-quality evaluation and a new browser/mobile interaction pass remain outside its scope. The earlier stopped eight-call synthetic evaluation remains historical evidence only.

External source coverage is bounded and availability can change. The checked live syllabus probe earlier returned not_found; syllabus extraction/ranking has offline fixture coverage. Derived provider abstractions with unverifiable inputs are withheld. Broad semantic/language quality, physical-device and inbox-confirmation checks remain open. Conditional asynchronous TinyAgent browser research awaits an actual interaction need. Two older synthetic PARTY_NOTES dead-letter jobs in the retained private account were left untouched; no queue was purged.

Evidence:

- [Milestone 3 completion and deployment](docs/results/milestone-3-completion-2026-11-15.md)

- [Latest tool coverage](docs/results/research-tool-parity-2026-11-15.md)
- [Current-question correction](docs/results/current-question-scope-2026-11-15.md)
- [Shared Haiku deployment](docs/results/haiku-team-deployment-2026-11-15.md)
- [Earlier integration/browser checkpoint](docs/results/milestone-3-integration-2026-11-15.md)
- [Original 3A live checkpoint](docs/results/milestone-3a-live-2026-11-14.md)

## Setup and future deployment

Use Node 24+, npm and Python 3.12/pip. `npm ci`; prepare a local `.venv` and install research/requirements.txt plus pytest; build the research asset with `npm run build:research`; run tests/typechecks and `npm run build`. See [research setup/provenance](research/README.md). The vendored clients are sufficient to build; the ignored SameClass reference checkout is optional.

The completion deployment used Anish’s local `default` profile, verified as account 851725603471. For shared deployment set your own AWS_PROFILE, AWS_REGION=us-east-2, VIBE_AWS_ACCOUNT=851725603471, VIBE_AWS_REGION=us-east-2 and VIBE_LOW_QUOTA=false. Run strict `npm run synth`, review `npm run diff -w infra`, then deploy only within the current chat's authorization. Do not overwrite secrets or change account/region implicitly.

Local `web/.env.local` is ignored and currently targets this shared backend; another machine must copy `web/.env.example` and fill the public values above. Use the absolute API Gateway URL locally. Production loads `/config.json`. Local provider keys are not needed for frontend-only work.

## Retained private account and history

The private deployment at https://d2fyk3jb2bpp2q.cloudfront.net remains separate in account 782610231983, Ohio. Accounts/chats were not migrated. Its local profile is `vibe-dev`; it requires explicit private account/region settings and VIBE_LOW_QUOTA=true due to the ten-concurrent-Lambda quota. Its $10 initial allowance applies separately. Do not use that URL to evaluate shared Haiku changes.

[The archived pre-handoff status](docs/history/status-before-milestone-3-handoff.md) preserves the prior M1/M2/private deployment chronology, settings and original Anish handoff. Those historical pending/commit statements are superseded by this file and the current plan. Git history identifies the exact published handoff revision.
