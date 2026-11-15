# Vibe

A shared chat for classmates, friends and teammates, with an AI participant you can mention as **@Vibe**.

Milestone 1 implements Cognito accounts, parties, link and QR invitations, persistent chat, AppSync refresh notifications and Bedrock replies. Milestone 2 adds personal memory, learning and sharing controls, Supermemory sync and memory-aware replies. Milestones 3A/3C/3D add attributed party memory, owner profile previews and bounded ASU, professor and web research. **3B broader personal learning remains open**; shared tasks and the expanded Milestone 4 plan are next. See [the teammate handoff](docs/milestone-3-handoff.md).

## Local development

Requires Node.js 24 or newer and npm.

```sh
npm ci
npm run dev
```

Read [STATUS.md](STATUS.md) for the deployed URL, verified behavior, remaining checks and teammate handoff.

The frontend reads public deployment settings from `/config.json`. With no configuration, it displays setup guidance. For local use, set the public `VITE_*` variables in `web/.env.local` using the values in `STATUS.md`. Use the absolute API Gateway URL locally. A copied deployed configuration needs its relative `/api` URL changed for local use. Cognito and the deployed API provide authentication and persistence during local frontend development.

```sh
npm run typecheck
npm test
npm run build
npm run build:research
npm run synth
```

The infrastructure synthesis bundles the backend, built frontend and Python research asset. Build that asset with Python and pip before synthesizing on a fresh checkout; it downloads pinned Linux Python 3.12 wheels into ignored `research/dist/`. See [research setup and attribution](research/README.md). Deployment requires credentials and a bootstrapped CDK environment. Defaults target Anish’s account `851725603471`; Bhavesh’s local shared-account profile is `vibe-team` (use your own authorized profile on another device), region `us-east-2`, with `VIBE_LOW_QUOTA=false`. The requested model is Claude Haiku 4.5 (`us.anthropic.claude-haiku-4-5-20251001-v1:0`), with different-model fallback disabled during evaluation. See STATUS.md for deployment readiness. For Bhavesh’s separate deployment use the complete environment settings in [STATUS.md](STATUS.md), including `VIBE_LOW_QUOTA=true`, account `782610231983` and region `us-east-2`.

```sh
npm run diff -w infra
npm run deploy -w infra
```

Deploy after authorization. The stack outputs the app URL and public configuration values. The stack retains persistent resources when removed. Anish’s account has its existing $50 monthly budget. Bhavesh approved $10 for initial setup/testing; that allowance does not enforce a billing cap. Provider usage is billed separately.

## Structure

- `web/` contains the React application.
- `backend/` contains the authenticated HTTP API, queued Bedrock worker, subscription authorization and durable notification dispatcher.
- `research/` contains the IAM-only Python course/professor adapter and pinned source modules.
- `shared/` contains client/server contracts.
- `infra/` contains the AWS CDK application.
- `docs/` contains the product, architecture, research and milestone plan.
- `.agents/skills/` contains the project's Codex skills.

Keep provider credentials in ignored environment files or AWS parameter storage. Public frontend configuration contains service identifiers and endpoints only.

## Attribution and AI assistance

Vibe is being built for Sunhacks 2026. Codex and Luna agents assisted with planning, implementation and focused verification. The ASU class-search and Rate My Professors integration reuses the team's earlier SameClass retrieval modules, with provenance recorded in `docs/previous-project.md`. The vendored subset is pinned to `3292dea39915a9c8f611d638847af0414ecfce27`; see [provenance](research/README.md). The separate `sameclass-track3/` reference checkout is ignored. These unofficial source interfaces can change; missing evidence stays explicit.

See [the implementation plan](docs/implementation-plan.md) for acceptance checks and current verification status.
