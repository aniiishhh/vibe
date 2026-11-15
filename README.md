# Vibe

A shared chat for classmates, friends and teammates, with an AI participant you can mention as **@Vibe**.

Milestone 1 implements Cognito accounts, parties, link and QR invitations, persistent chat, AppSync refresh notifications and Bedrock replies. Milestone 2 adds personal memory, learning and sharing controls, Supermemory sync and memory-aware replies. Course research and shared tasks follow in later milestones.

## Local development

Requires Node.js 24 or newer and npm.

```sh
npm ci
npm run dev
```

Read [STATUS.md](STATUS.md) for the deployed URL, verified behavior and Milestone 2 handoff.

The frontend reads public deployment settings from `/config.json`. With no configuration, it displays setup guidance. For local use, set the public `VITE_*` variables in `web/.env.local` using the values in `STATUS.md`. Use the absolute API Gateway URL locally. A copied deployed configuration needs its relative `/api` URL changed for local use. Cognito and the deployed API provide authentication and persistence during local frontend development.

```sh
npm run typecheck
npm test
npm run build
npm run synth
```

The infrastructure synthesis bundles the backend and built frontend. Deployment requires AWS credentials and a bootstrapped CDK environment in account `851725603471`, region `us-east-2`.

```sh
npm run diff -w infra
npm run deploy -w infra
```

Deploy after authorization. The stack outputs the app URL and public configuration values. The stack retains persistent resources when removed. The existing account-wide $50 monthly budget sends notifications and other account workloads contribute to that total.

## Structure

- `web/` contains the React application.
- `backend/` contains the authenticated HTTP API, queued Bedrock worker, subscription authorization and durable notification dispatcher.
- `shared/` contains client/server contracts.
- `infra/` contains the AWS CDK application.
- `docs/` contains the product, architecture, research and milestone plan.
- `.agents/skills/` contains the project's Codex skills.

Keep provider credentials in ignored environment files or AWS parameter storage. Public frontend configuration contains service identifiers and endpoints only.

## Attribution and AI assistance

Vibe is being built for Sunhacks 2026. Codex and Luna agents assisted with planning, implementation and focused verification. The planned ASU class-search and Rate My Professors integration reuses the team's earlier SameClass retrieval modules, with provenance recorded in `docs/previous-project.md`. That source remains in the separately managed `sameclass-track3/` repository.

See [the implementation plan](docs/implementation-plan.md) for acceptance checks and current verification status.
