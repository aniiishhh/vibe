# Vibe status and teammate handoff

Updated November 14, 2026, America/Phoenix. Working branch `anish/implementation`.

## Current checkpoint

Milestones 1 and 2 are implemented and deployed on `anish/implementation`. Milestone 2 deployment was authorized by the user in this chat. CloudFormation `Vibe-dev` is `UPDATE_COMPLETE`. The latest successful CDK update includes memory ingestion, retrieval and the mobile export fix. Milestone 3, memory follow-ups plus class and general research, is next. Milestones 3–5 remain pending.

The source in this branch includes the deployed application and the live-verification fixes. Infrastructure is declared in `infra/lib/vibe-stack.ts`. Public deployment settings are served at `/config.json`.

## Live deployment

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

## Continue with Milestone 3

Read the expanded Milestone 3 checklist in `docs/implementation-plan.md`. It now explicitly includes structured party-note creation and correction, broader personal extraction, owner-facing Supermemory profiles/buckets, improved retrieval and focused cross-domain checks. These additions are planned and remain unimplemented. Start with the party-note write path and extraction ownership safeguards, then integrate profiles/retrieval alongside research. Obtain the separately managed `sameclass-track3/` repository on the teammate's device, inspect its Python environment and source attribution, run the existing focused offline tests and one bounded live ASU/RMP scenario, then package the approved retrieval clients behind the IAM-invoked Python tool adapter. Add deterministic schedule comparison and TinyFish Search/Fetch with source citations. Keep memory permissions and current chat behavior intact.

The current agent still performs a bounded conversational model call with memory context. General-purpose research tool execution and citations belong to Milestone 3. Provider profile buckets are not used by the current UI; the compact preview is rendered from canonical approved points.
