> Historical snapshot before the November 15 Git handoff. Current status is in ../../STATUS.md; pending/next-step/commit statements below describe their original checkpoints.

# Vibe status and teammate handoff

Updated November 15, 2026, America/Phoenix. Working branch `codex/milestone-3-party-memory`.

## Expanded class/review/syllabus tools — deployed for manual testing

Compared the adapter with SameClass and found two integration limits: class search required exact course codes, and omitted syllabus fallbacks were forwarded as an empty list, disabling the upstream historical search. Exposed allowlisted keyword/instructor and other supported class filters, including search without a course number. Restored automatic six-prior-term syllabus lookup using the existing current/same-professor, historical/same-professor, then different-professor ranking. Preserved source-term/instructor labels and page excerpts, with visible fallback/partial flags. Added bounded RMP pagination/cursors plus requested-course sample metrics, separately from overall professor metrics. 56 backend tests, 10 adapter tests and workspace typechecks pass. The reviewed agent/research-only deployment completed successfully: Vibe-dev UPDATE_COMPLETE, both functions Active/Successful, Haiku retained. No IAM, web or stateful-resource changes; manual app testing remains with the user. See docs/results/research-tool-parity-2026-11-15.md. No extra live recommendation scenario was run.

## Current-question/professor-review correction — deployed for manual retest

Manual retesting found that a narrow professor/course question continued the broader class-planning task, mixed in another professor, exhausted evidence space and repeated warnings. The agent now pins the authenticated triggering request separately from background party context; retrieval starts with that request and includes only short earlier human context, excluding assistant recaps. Prompt rules scope professor assessments to the named subject/course, distinguish course-specific reviews from overall metrics and request a cautious evidence-based assessment rather than a curriculum recap. The RMP tool now accepts an optional course code and returns compact labelled matching-course evidence (or explicitly other-course sample), preserving timestamps, professor metrics and source URLs. Review cache keys are versioned to avoid old bulky payloads. Final warnings and UI warnings are deduplicated. 55 backend tests, five adapter tests, workspace typechecks and web build passed. The reviewed code/asset-only update deployed successfully to shared Vibe-dev (UPDATE_COMPLETE). Agent/research workers are Active/Successful and the agent remains on the requested Haiku model. Website/config return HTTP 200 for the expected shared pool; no IAM or stateful resources changed; no additional live recommendation scenario was run, per the user's manual-testing preference. Retry the same professor/course question in the existing party after a refresh. See docs/results/current-question-scope-2026-11-15.md.

## Current shared deployment — Haiku ready for manual testing

The user authorized returning development to Anish’s account **851725603471**, region **us-east-2**. Stack **Vibe-dev is UPDATE_COMPLETE**. Use **https://d1ia555vbcj8k2.cloudfront.net** for the new application. Agent and memory workers are Active/Successful with model **us.anthropic.claude-haiku-4-5-20251001-v1:0**; different-model fallback is disabled. The agent invokes the new IAM-only `vibe-dev-research` Lambda. The model returned READY in a real request before deployment. Website and public config return HTTP 200 with the shared Cognito pool. No stateful resources were replaced.

CLI profile **vibe-team** resolves to IAM user `bhavesh`. Verified **VibeDeployers** group has **AdministratorAccess** and SignInLocalDevelopmentAccess; the extra scoped developer policy in docs/aws/ is unnecessary while admin access is effective. Anthropic use-case details were submitted using factual Vibe student-project information and are now effective. TinyFish is SSM SecureString `/vibe/dev/tinyfish-api-key` version 1; existing `/vibe/dev/supermemory-api-key` was preserved. Runtime IAM independently scopes the Haiku inference profile and verified US destination models (us-east-1, us-east-2, us-west-2). The existing **Monthly Budget $50** was rechecked; it is an alerting budget, not a hard cap, and actual costs have not been measured.

The shared update includes the memory corrections/3C/3D described below, natural semester conversion, new level/keyword discovery over real ASU offerings, course grouping/deduplication, deterministic level filtering and rejection of textual tool-call markup as finished answers. Real public discovery probes returned CSE 510 and EEE 523/524 for their checked topics. Local **53 backend tests, three adapter tests, typechecks, production build and strict synthesis passed**; reviewed diff added only the research Lambda/log/role and updated code/roles/web assets. Anish’s latest `3e25592` changes planning documents only; its 4A/4B plan is preserved locally.

**The user will manually test Haiku behavior.** An extra pre-deployment synthetic model/source evaluation reached its eight-call budget without a final answer; the user then explicitly stopped that extra testing. No complete Haiku recommendation-quality or shared-app behavioral pass is claimed. No further behavioral scenario was run. The old private deployment and its data are retained separately; accounts/chats were not migrated. Local ignored `web/.env.local` now targets the shared backend. No commit or push has been made.

| Shared setting | Value |
| --- | --- |
| API | https://b8cojfsw6f.execute-api.us-east-2.amazonaws.com/api |
| Cognito pool/client | us-east-2_zrHcAFg7r / 2q4vsdoqv1037okr9s3ivm8lim |
| Events HTTP | https://ged5txwgabfzpcqjmkazypa5s4.appsync-api.us-east-2.amazonaws.com/event |
| Events realtime | wss://ged5txwgabfzpcqjmkazypa5s4.appsync-realtime-api.us-east-2.amazonaws.com/event/realtime |
| Table / queues | vibe-dev / vibe-dev-agent.fifo / vibe-dev-memory.fifo in account 851725603471 |

For future shared deployments use AWS_PROFILE=vibe-team, AWS_REGION=us-east-2, VIBE_AWS_ACCOUNT=851725603471, VIBE_AWS_REGION=us-east-2 and VIBE_LOW_QUOTA=false. Build web/research assets, synthesize, review the CDK diff and deploy. See `docs/results/haiku-team-deployment-2026-11-15.md` for the handoff. Broader 3B learning and Milestone 4 remain pending. The following private-account checkpoints are historical; do not use their URL to evaluate Haiku.

## November 15 follow-up: natural semester names

User retesting exposed an integration gap: the agent prompt/tool description required internal ASU codes despite SameClass already supporting semester names. Added a deterministic backend resolver adapted from pinned SameClass `bot/src/domain/semester.ts`; every course tool and syllabus fallback accepts Spring/Summer/Fall/Autumn plus year, or existing legacy codes. The model now reuses the semester/year supplied by people in party context and only asks for a semester/year when missing or ambiguous. Course-number suggestions must be grounded in real offerings. Local 51 backend tests and workspace typechecks pass; reviewed CDK diff changes only AgentFunction code. The agent-only CloudFormation deployment completed successfully (UPDATE_COMPLETE). The targeted live request passed: semester/year came only from the party goal, persisted ASU search completed, citations used term 2271, and the answer did not request a term code. The targeted script exited successfully and removed 17 fixture records, one synthetic user and its provider namespaces. Reproduce with VIBE_VERIFY_SEMESTER=true using scripts/verify-party-memory.mjs.

## November 15: memory corrections, 3C and 3D — ready for user retest

Implemented and deployed in Bhavesh's account. Party preferences now have source-bound named owners, stable author/topic records, grouped cards and restricted correction controls. Duplicate contributor/updater labels are removed. Legacy single-author anonymous notes receive an attributed projection; new topic records supersede legacy rows without destructive migration. Automatic additions no longer invalidate every running answer, while manual corrections/deletion, membership, sharing and stale-history guards remain enforced.

3C adds owner-only categorized current-point previews, Supermemory profile bucket configuration/filtered reads, provider freshness states, canonical correction fallback and bounded constraint selection. Unverified provider-derived prose is withheld; private aggregate profiles never enter group context. 3D adds bounded persisted Bedrock tool exchanges, the IAM-only pinned SameClass Python adapter, ASU course/syllabus lookup, campus-aware RMP identity/review lookup, TinyFish Search/Fetch, citations/observation dates, public non-seat caching and deterministic normalized schedule comparison.

Final local checks: **48 backend tests, two adapter tests, workspace typechecks, production build and strict CDK synthesis passed**. All 53 upstream retrieval tests also passed earlier against the pinned source. The existing frontend bundle-size advisory remains. Live source probes succeeded for ASU, RMP candidates/reviews and TinyFish Search/Fetch; the checked syllabus returned not_found.

All final live application assertions passed: sourced decisions/questions, owner correction governing the next answer, stale edits, named preference consolidation and cross-owner rejection, concurrent extraction/answers, owner-preview isolation/correction, persisted successful ASU/comparator/RMP identity tools, general TinyFish research/citations, independent desktop/mobile browsers, note CRUD, cross-user refresh/reload, 390px layout, separate-party isolation and removed-member rejection. Screenshots were visually inspected. RMP did not confidently match the particular checked instructor and retained that uncertainty.

The final harness exited during its global memory-queue-drain cleanup wait, after application/browser assertions passed. A scoped recovery verified the exact administrative example.com test identities, removed **155 fixture records, two users and two parties**, then removed their provider namespaces. The harness now deletes scoped canonical parents and waits for bounded in-flight writes, independent of unrelated global queue work; its syntax check passed. This harness-only cleanup adjustment was not followed by another complete run. Two older PARTY_NOTES dead-letter jobs observed during diagnosis were left untouched; no queue was purged. See `docs/results/milestone-3-integration-2026-11-15.md` for evidence and limitations.

The latest reviewed memory-only and agent-only CloudFormation updates completed successfully; no stateful resources were replaced. The existing $10 initial testing allowance applies; actual billing totals have not been measured. Final AWS recheck: stack UPDATE_COMPLETE; memory queue visible/in-flight counts both zero. Both provider keys are server-side SecureStrings. No commit/push or submission was performed.

Remaining: broader global personal learning (3B), broad live semantic/language evaluation, physical-phone and email-confirmation checks. Asynchronous TinyAgent research remains conditional on an observed source-interaction need. Current sources work through typed clients/Search/Fetch. User retesting should start with a fresh two-person party and explicit ASU term; background notes can appear after the reply.

## User-reported issues addressed — November 15, 2026

The original two-person class-planning test exposed anonymous preferences, duplicate attribution, unrestricted edits, repeated notes and answer failures during concurrent memory additions. The changes and final application checks above address these cases. ASU/RMP/TinyFish tools are now integrated through the backend rather than being enabled merely by a class-planning party goal.

## Retained private deployment — Bhavesh’s account

The memory corrections plus 3C/3D are deployed; final application assertions passed on November 15, 2026. Stack `Vibe-dev` is `UPDATE_COMPLETE` in account `782610231983`, region `us-east-2`. The app is **https://d2fyk3jb2bpp2q.cloudfront.net**. Anish's separate deployment below is unchanged.

| Setting | Value |
| --- | --- |
| API | `https://ducigz8w50.execute-api.us-east-2.amazonaws.com/api` |
| Cognito pool | `us-east-2_mJtx6m7dl` |
| Cognito public client | `7jnclgp0celfa1p7hap7k3gjdp` |
| Events HTTP | `https://afdrocwq3zhshei4r4v5rfo6aq.appsync-api.us-east-2.amazonaws.com/event` |
| Events realtime | `wss://afdrocwq3zhshei4r4v5rfo6aq.appsync-realtime-api.us-east-2.amazonaws.com/event/realtime` |
| Table / queues | `vibe-dev`, `vibe-dev-agent.fifo`, `vibe-dev-memory.fifo` in this account |
| Provider secrets | SSM SecureStrings `/vibe/dev/supermemory-api-key` and `/vibe/dev/tinyfish-api-key`; values excluded from source/logs |
| Local AWS profile | `vibe-dev`, with region configured to Ohio; current login is root |
| Approved allowance | $10 initial setup/testing, not an enforced billing cap |

Bedrock verification denial is resolved: a 13-token readiness probe and actual application AI runs passed. The supplied Supermemory key passed isolated add/process/search/replace/delete and namespace cleanup. `CDKToolkit` bootstrap completed with standard CDK roles/default CloudFormation execution policy. Actual costs were not measured, and the budget lookup returned no configured budget. TinyFish Search/Fetch is now integrated server-side in 3D.

Live Lambda quota is ten concurrent executions. Use `VIBE_LOW_QUOTA=true` on every deployment to this account: agent reserved concurrency is omitted and SQS maximum concurrency is two. Memory SQS maximum concurrency remains two. Without the flag, Anish's existing defaults remain unchanged. Deploy using:

```sh
export AWS_PROFILE=vibe-dev
export AWS_REGION=us-east-2
export VIBE_AWS_ACCOUNT=782610231983
export VIBE_AWS_REGION=us-east-2
export VIBE_LOW_QUOTA=true
npm run build
npm run build:research
npm run synth
npm run diff -w infra
npm run deploy -w infra -- --outputs-file cdk.out/deployment-outputs.json
```

Ignored `web/.env.local` now points at this deployment; no local public-config override exists. Use Node 24 for local development. Use a developer identity for routine AWS work; the current root login was not replaced and no human IAM identity was created.

### Verification and next work

Current acceptance evidence and cleanup recovery are above and in `docs/results/milestone-3-integration-2026-11-15.md`. Retest the deployed app after a hard refresh. Use `scripts/verify-party-memory.mjs` for synthetic integration checks; optional Playwright dependencies live under `/private/tmp/vibe-browser-tests`, not globally. Node 24 is required. The complete earlier 3A checkpoint is preserved in `docs/results/milestone-3a-live-2026-11-14.md`.

The pinned research asset must be built before synthesis on a new machine. See `research/README.md` and the root README for setup, source attribution and bounded-source behavior. Broader 3B personal-learning changes remain next; do not describe all of Milestone 3 as complete.

## Historical Milestone 3A implementation checkpoint (superseded by November 15 results)

Working branch `codex/milestone-3-party-memory`, based on Anish's `41d6318`. Implemented structured party-note creation/extraction, type/provenance/version display, member correction/deletion, tombstones, retry deduplication, source suppression and note-revision invalidation of agent context. The existing deployed Milestone 2 application described below is unchanged.

The @Vibe send transaction now emits `PARTY_NOTES` through the existing outbox/memory queue. Dispatcher and worker recognize the new type; a separate `notes-<partyId>` FIFO group isolates note extraction from conversation indexing. Manual note routes use POST `/parties/{id}/facts`, PATCH and DELETE `/parties/{id}/facts/{factId}`. All writes recheck membership transactionally. Note history and suppression records are party-scoped. No new AWS resource is required for this feature.

Automated local checks: 31 backend tests (21 existing + 10 new) passed, as did workspace TypeScript checks and the frontend production build. The existing frontend chunk-size advisory remains. Strict CDK synthesis also passed, including a final synthesis targeting account `782610231983` in `us-east-2`. These checks use mocked storage/model outputs for the new feature; no live extraction or browser acceptance is claimed. `.env` and the ignored Ray checkout are preserved.

See `docs/milestone-3a-testing.md` for behavior, limitations and reproducible tests. Important limits: extraction uses only twenty recent messages at each mention; the initial answer may precede the background notes; a correction conservatively excludes older-epoch messages from subsequent extraction; semantic paraphrase consolidation and note-expiry editing in the UI remain future work. Exact repeated text/type is deduplicated. Human review is still needed for model classifications.

Browser testing of the new feature requires an authorized deployment of API, worker, dispatcher, agent and frontend together. The local frontend alone against Anish's deployed backend cannot test the new endpoints. Bhavesh's chosen separate AWS account is `782610231983`; deployment targeting can use `VIBE_AWS_ACCOUNT` / `VIBE_AWS_REGION`. The local `vibe-dev` login previously resolved to root; use a developer identity for ongoing work. Its prior Bedrock verification denial has not been rechecked here. Credentials remain outside Git. No deployment, IAM change, commit or push was performed.

Milestone 3A live acceptance and Milestones 3B–3D remain pending. Start the next live check with the sourced decision/question flow and a correction controlling the next answer; recheck the final browser flow after fixes.

## Anish’s prior Milestone 1/2 checkpoint

Milestones 1 and 2 are implemented and deployed on `anish/implementation`. Milestone 2 deployment was authorized by the user in this chat. CloudFormation `Vibe-dev` is `UPDATE_COMPLETE`. The latest successful CDK update includes memory ingestion, retrieval and the mobile export fix. Milestone 3, memory follow-ups plus class and general research, is next. Milestones 3–5 remain pending.

The source in this branch includes the deployed application and the live-verification fixes. Infrastructure is declared in `infra/lib/vibe-stack.ts`. Public deployment settings are served at `/config.json`.

## Shared endpoint settings (now updated above to Haiku)

| Setting | Current value |
| --- | --- |
| App | https://d1ia555vbcj8k2.cloudfront.net |
| AWS account | `851725603471` |
| Region | `us-east-2` (Ohio) |
| App stack | `Vibe-dev` |
| CDK bootstrap stack | `CDKToolkit`, created in Ohio |
| HTTP API | `https://b8cojfsw6f.execute-api.us-east-2.amazonaws.com/api` |
| Cognito pool | `us-east-2_zrHcAFg7r` |
| Cognito public client | `2q4vsdoqv1037okr9s3ivm8lim` |
| DynamoDB table | `vibe-dev` |
| Agent queue | `vibe-dev-agent.fifo` |
| Agent dead-letter queue | `vibe-dev-agent-dlq.fifo` |
| AppSync HTTP | `https://ged5txwgabfzpcqjmkazypa5s4.appsync-api.us-east-2.amazonaws.com/event` |
| AppSync WebSocket | `wss://ged5txwgabfzpcqjmkazypa5s4.appsync-realtime-api.us-east-2.amazonaws.com/event/realtime` |
| Primary Bedrock model | `deepseek.v3.2` |
| Configured fallback | `minimax.minimax-m2.5` |
| Existing budget | Account-wide $50 monthly budget with notifications |

The bootstrap uses CDK's default CloudFormation execution policy, `AdministratorAccess`. Deployment credentials require authorized access to the account and CDK roles. Application Lambdas use their own scoped roles. Persistent resources have retain policies, so removing a stack can leave billable resources behind. Budget alerts are notifications. External provider billing is separate.

### Deployed components

- React/Vite frontend in private S3, delivered through CloudFront OAC. `/api*` forwards authenticated requests without caching.
- Cognito email/password accounts and email-confirmation UI.
- API Gateway JWT authorization and the `vibe-dev-api` Lambda.
- DynamoDB on-demand table with PITR, Streams, TTL, GSI1 membership discovery and GSI2 pending-outbox recovery.
- AppSync Events with Cognito subscriptions, synchronous membership authorization and IAM-only publishing.
- `vibe-dev-agent`, `vibe-dev-dispatcher` and `vibe-dev-subscription` Lambdas.
- SQS FIFO agent execution, conditional leases, durable model results and idempotent replies.
- Five-minute outbox recovery schedule and 14-day application logs.

Supermemory ingestion and retrieval, the memory queue/worker and SSM credential reference are deployed. TinyFish runtime integration, the Python research Lambda and SES invitation delivery remain pending. Supermemory and TinyFish keys existed on the original developer's machine and passed earlier authentication/read checks. Those ignored files do not travel with Git.

## Verification completed

- Workspace TypeScript checks, five targeted backend tests, frontend production build and strict CDK synthesis passed.
- Two independent Cognito test accounts passed login, profile reads, party creation, invite joining, saved chat and duplicate-send handling.
- A real DeepSeek reply completed and persisted exactly once. Explicit SQS redelivery retained one reply.
- Non-member reads failed. Removing a member prevented subsequent content reads and new subscriptions.
- Live WebSocket checks accepted member subscriptions and rejected wildcard subscriptions and client publishing.
- Two isolated browsers joined the same party, showed Live, exchanged messages and displayed the same @Vibe reply. A cross-browser message appeared in about 1.6 seconds in that observation.
- Outbox records left pending by the original attribute-expression bug recovered after the fix. Pending count was zero at verification.
- Two temporary accounts and 63 fixture records across three test parties were deleted. Local test credentials were deleted.

The deployed fix aliases `ttl` in DynamoDB rate-counter and delivery-ack expressions. Keep DynamoDB expression attribute names aliased when adding memory code.

### Remaining verification

Email inbox delivery and user-entered confirmation codes were not exercised because test users were provisioned administratively. Browser reload and mobile chat checks were deferred to conserve usage. Fresh API history reads confirmed persistence. The main frontend bundle has a size advisory, about 754 KB minified / 232 KB gzip. Dependency audit reported two moderate findings associated with CDK's transitive minimatch dependency.

## Run on another device

Install Node.js 24 or newer and npm. Clone the implementation branch.

```sh
git clone --branch anish/implementation https://github.com/aniiishhh/vibe.git
cd vibe
npm ci
cp web/.env.example web/.env.local
```

Set the following public values in `web/.env.local`.

```dotenv
VITE_REGION=us-east-2
VITE_USER_POOL_ID=us-east-2_zrHcAFg7r
VITE_USER_POOL_CLIENT_ID=2q4vsdoqv1037okr9s3ivm8lim
VITE_API_URL=https://b8cojfsw6f.execute-api.us-east-2.amazonaws.com/api
VITE_EVENTS_HTTP_ENDPOINT=https://ged5txwgabfzpcqjmkazypa5s4.appsync-api.us-east-2.amazonaws.com/event
VITE_EVENTS_REALTIME_ENDPOINT=wss://ged5txwgabfzpcqjmkazypa5s4.appsync-realtime-api.us-east-2.amazonaws.com/event/realtime
```

```sh
npm run dev
```

Open `http://localhost:5173`. Local API CORS allows localhost and 127.0.0.1 on port 5173. The local frontend uses the existing deployed backend and shared data. Browser users sign up or sign in through Cognito. AWS credentials are needed for infrastructure changes, not for using the web UI.

The deployed `/config.json` sets `apiUrl` to `/api`. For local development use the absolute API Gateway URL above. A local `web/public/config.json` overrides environment values, so remove or update that file if it contains an old relative API URL.

## Replicate deployment from another device

Configure your own authorized AWS credentials through your team's normal AWS sign-in/profile process. Keep credentials outside Git. CDK and esbuild are project-local npm dependencies. The Codex AWS MCP configuration additionally uses `uvx`; it is optional for running the application and CDK.

For the existing account/region, bootstrap already exists. Updating from another computer does not require another bootstrap. Authenticate to the same account, check the target in `infra/bin/app.ts`, then run from the repository root.

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run synth
npm run diff -w infra
npm run deploy -w infra -- --outputs-file cdk.out/deployment-outputs.json
```

`npm run build` must precede synthesis/deployment because CDK packages `web/dist`. Deployment generates public `config.json`, uploads the SPA and invalidates CloudFront. The output file is under ignored build output. Confirm deployment authorization in the current chat before deploying further changes.

To deploy a separate environment, first change the account/region/stack target in `infra/bin/app.ts` and the hard-coded `STAGE` and resource names in `infra/lib/vibe-stack.ts`. This project currently targets a single `dev` environment. Bootstrap a new target using the project-local CLI when authorized.

```sh
cd infra
npx cdk bootstrap aws://TARGET_ACCOUNT/TARGET_REGION
```

Use that deployment's output identifiers in local configuration. Model availability, account permissions and quotas need checking in a different account. No custom domain is configured.

## Milestone 2 implementation guide

Read `AGENTS.md`, this file, `docs/product-idea.md`, `docs/architecture.md` (especially memory), `docs/technical-research.md` and `docs/implementation-plan.md`. Relevant skills are `.agents/skills/supermemory/`, DynamoDB, Bedrock, AWS CDK and AWS SDK JS v3.

1. Obtain the Supermemory API key through the team's private credential channel. Put local keys in an ignored `.env`. For deployed workers, provision the planned SSM SecureString `/vibe/dev/supermemory-api-key` and scoped runtime access. Milestone 1 does not provision or read it.
2. Verify isolated Supermemory add/search/explicit replacement/delete, including processing and partial deletion failures. Use official v5 docs and SDK. Reusing an ID in `add` can append/diff; explicit updates perform replacement.
3. Add canonical memory ownership, revisions, approvals, expiry and tombstones to DynamoDB. Extend the existing outbox with the memory queue/worker. The dispatcher currently supports `REFRESH` and `AGENT_RUN` only.
4. Implement private manual points first, then self-authored automatic candidates, explicit owner sharing approval and per-party opt-in. Keep party, private-user and approved-shared namespaces separate.
5. Add memory routes, UI and shared contracts. Filter retrieval through current canonical records and recheck permissions/revisions before committing model output. Cross-party retrieval must not expose private source metadata.
6. Add compact profile previews and Markdown export. Demonstrate learning in party A, approved reuse in party B, and a correction controlling the next answer. Test the specific privacy and stale-job regressions in the plan.

The deployed agent performs a bounded conversational model call with memory retrieval and dependency checks. General research tool execution remains pending. Extend the normal @Vibe path while preserving saved model results, reply IDs, membership checks and bounded costs.

### Code entry points

| Path | Responsibility |
| --- | --- |
| `backend/src/handler.ts` | Authenticated routes, invitations, messages and send transactions |
| `backend/src/store.ts` | DynamoDB helpers, membership and outbox records |
| `backend/src/agent.ts` | Queued run, context, Bedrock, persisted result and reply |
| `backend/src/dispatcher.ts` | Stream dispatch and scheduled recovery |
| `backend/src/subscription.ts` | Live subscription membership checks |
| `shared/src/index.ts` | Client/server contracts |
| `web/src/App.tsx` | Party, auth, invite and chat screens |
| `web/src/auth.tsx` | Auth lifecycle and query-cache clearing |
| `infra/lib/vibe-stack.ts` | AWS resources and execution-role permissions |
| `scripts/verify-milestone1.mjs` | Optional live API smoke scenario using supplied test accounts |

The optional smoke script reads `VIBE_URL`, `VIBE_TEST_EMAIL_A`, `VIBE_TEST_PASSWORD_A`, `VIBE_TEST_EMAIL_B`, and `VIBE_TEST_PASSWORD_B` from an ignored environment file. It creates a test party and removes B's membership; clean up its fixtures afterward. No test credentials are committed.

The ignored `sameclass-track3/` source repository is a Milestone 3 dependency. A fresh clone of Vibe does not include it. Obtain it separately when beginning class research and preserve its provenance.

## Status maintenance

Update this file at every completed milestone, deployment, material verification result or handoff. Record the date, branch, actual AWS stack status, changed endpoints/resources, checks completed, pending checks and exact next work. Keep `docs/implementation-plan.md` aligned. Include any new setup, credential names and reproducible deployment steps, while keeping secret values out of the report.

## Milestone 2 deployment checkpoint

The source now implements personal-memory CRUD, optimistic edits, source-wide deletion/correction tombstones, candidate approval, learning controls, per-party shared-memory opt-in, a memory page, compact preview and owner Markdown export. Both learning and per-party sharing default off, including older records without these settings.

The agent builds bounded context from current-party history and approved, opted-in personal facts. Provider results are rehydrated from canonical DynamoDB records. Current canonical facts also cover indexing delays. Private provenance is excluded from cross-party prompts. Membership and memory revisions guard saved model results and final replies, with one bounded regeneration when dependencies change. Old source spans and stale assistant replies are suppressed.

The background worker ingests party messages into the party SuperRAG namespace and personal facts into separate private/shared namespaces. Personal documents use versioned IDs. Canonical deletion revokes reuse immediately; partial provider failures stay visible and are retried. Repeated sync failures are durably requeued through the outbox schedule. Automatic learning processes the author's own eligible statements on an @Vibe mention or after ten pending messages from that author, with at most five candidates per batch. English first-person statements are currently used to filter extraction input. This trigger detail refines the earlier party-wide threshold in the architecture.

### Deployed Milestone 2 additions

- FIFO `vibe-dev-memory.fifo` with `vibe-dev-memory-dlq.fifo`.
- Node.js 24 `vibe-dev-memory` Lambda, 90-second timeout, SQS batch size one, 540-second queue visibility, maximum two concurrent queue invocations.
- Agent and worker access to `/vibe/dev/supermemory-api-key` through SSM SecureString and scoped IAM/KMS permissions.
- Dispatcher routing for `MEMORY_SYNC`, `MEMORY_EXTRACT` and `PARTY_SYNC`.

The existing Supermemory key was provisioned as a SecureString named `/vibe/dev/supermemory-api-key` in Ohio through the authorized private credential workflow. On another account, provision the same path before enabling that deployment. The value is absent from CDK source and Git. Local worker runs can read `SUPERMEMORY_API_KEY` from an ignored environment file. Lambda uses `SUPERMEMORY_PARAMETER_NAME`. The provider client caches credentials until the execution environment restarts.

### Milestone 2 checks

Workspace TypeScript checks, 21 focused backend tests, the frontend production build and CDK synthesis passed. The isolated real Supermemory probe passed add/process, namespace-scoped search, explicit content replacement and deletion, then deleted its namespace. Run that optional probe with `node --env-file=.env scripts/verify-supermemory.mjs` when intentionally validating provider credentials and lifecycle behavior.

Live application checks passed manual private points with learning off, stale-version conflicts, separation of two users' memory lists, own-message candidate extraction, approval and opted-in reuse across two parties, and an immediate vegetarian-to-vegan correction governing the next answer. Canonical deletion revoked reuse immediately. The first provider-cleanup wait exceeded 180 seconds because a transient failure left the owner FIFO group invisible for 540 seconds. A targeted invocation confirmed deletion cleanup. The worker now resets failed-message visibility to ten seconds; a subsequent normal queued private sync and deletion completed successfully. The full multi-party script was not rerun after that focused fix.

The memory screen was checked in a real browser at desktop and 390px using account B. Learning Off, the empty state, manual form and export control rendered without console errors or horizontal overflow. A clipped mobile export label was fixed and rebuilt, then deployed; that final visual change was not browser-rechecked. Two temporary test accounts, 65 DynamoDB fixture records across two parties, and six private/shared/party namespace targets were cleaned up. No test credentials remain in the repository.

New backend modules are `memory-routes.ts`, `memory-store.ts`, `memory-provider.ts`, `memory-worker.ts` and `memory-context.ts`. The frontend memory page is `web/src/MemoryPage.tsx`. The prepared infrastructure is in the existing stack, so use the build/synth/diff/deploy sequence above after authorization. Dependencies are in the lockfile, installed with `npm ci` on another device.

## Anish’s original Milestone 3 handoff (historical)

Read the expanded Milestone 3 checklist in `docs/implementation-plan.md`. It now explicitly includes structured party-note creation and correction, broader personal extraction, owner-facing Supermemory profiles/buckets, improved retrieval and focused cross-domain checks. These additions are planned and remain unimplemented. Start with the party-note write path and extraction ownership safeguards, then integrate profiles/retrieval alongside research. Obtain the separately managed `sameclass-track3/` repository on the teammate's device, inspect its Python environment and source attribution, run the existing focused offline tests and one bounded live ASU/RMP scenario, then package the approved retrieval clients behind the IAM-invoked Python tool adapter. Add deterministic schedule comparison and TinyFish Search/Fetch with source citations. Keep memory permissions and current chat behavior intact.

The current agent still performs a bounded conversational model call with memory context. General-purpose research tool execution and citations belong to Milestone 3. Provider profile buckets are not used by the current UI; the compact preview is rendered from canonical approved points.

## Milestone 4 planning update

Milestone 4 now explicitly includes context-aware interpretation of short replies across multiple speakers and a time-based background trigger for quieter users. The plan specifies sourced party participation, ambiguous references and withdrawals, ownership and approval safeguards, deduplication across triggers, and bounded scheduling with latency/cost checks. Initial proposed settings are a two-minute idle period, five-minute discovery tick and one timer batch per party per five minutes; implementation should keep them configurable. These are planned additions. The detailed tasks and acceptance scenarios are in sections 4A and 4B of `docs/implementation-plan.md`.
