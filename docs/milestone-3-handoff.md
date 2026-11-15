# Milestone 3 handoff for Anish and Codex

The user approved pushing the completed 3A/3C/3D implementation to `anish/implementation` on November 15, 2026, with **3B explicitly open**. Do not mark all of Milestone 3 complete. Anish's latest planning-only commit `3e25592` and its Milestone 4A/4B/4C scope are preserved.

## Delivered

- Party-scoped attributed decisions/questions and preference cards, author/topic consolidation, restricted edits, correction epochs, provenance and stale-context guards.
- Owner-only categorized canonical profile previews with Supermemory bucket/profile integration, freshness/approval/version validation and private-summary exclusion from group context.
- Haiku 4.5 for replies/extraction, with different-model fallback disabled during evaluation; bounded persisted native tool execution and citations.
- ASU keyword/instructor/course searches and supported filters; natural semester conversion; level-filtered discovery; deterministic supplied-interval comparison.
- Current/historical same-professor syllabus lookup followed by labelled other-professor fallbacks, page excerpts and explicit source/coverage flags.
- RMP general and course-specific review samples, separate professor/sample metrics and bounded cursor pagination; TinyFish Search/Fetch.
- Current-question scoping, compact review evidence and duplicate-warning handling from manual feedback.

## Open work and ownership

**3B remains unimplemented:** replacing the English first-person gate, broader/mixed-language self-descriptions, bounded pending extraction across eligible authors on a mention, continuation, durable-versus-temporary classification and broader fact consolidation/learning-state visibility. Existing Milestone 2 ownership, learning-off, review/approval, opt-in and tombstone protections must be preserved. The checklist in implementation-plan.md remains unchecked.

Milestone 4A concerns contextual short replies/participation; 4B adds idle/timer learning for quieter users; 4C adds accepted tasks, modes and email. Their detailed plan is unchanged. 3B overlaps the extractor/cursor ownership that 4A/4B need, so resolve that gap explicitly rather than treating it as already delivered. Start by reading `backend/src/memory-worker.ts`, `backend/src/handler.ts`, `backend/src/memory-store.ts` and their tests. Party preference extraction is separate in `party-note-extraction.ts`; do not silently convert party preferences into approved global memories.

## Current deployment

App: https://d1ia555vbcj8k2.cloudfront.net. Stack Vibe-dev, account 851725603471, us-east-2, UPDATE_COMPLETE. Agent/research workers Active/Successful. Model: `us.anthropic.claude-haiku-4-5-20251001-v1:0`.

Supermemory and TinyFish credentials already live as SecureStrings `/vibe/dev/supermemory-api-key` and `/vibe/dev/tinyfish-api-key`. Do not overwrite or put them in Git/frontend settings. Bhavesh's CLI profile is `vibe-team`; Anish should use his own authorized profile and verify STS account first. The existing Monthly Budget $50 was confirmed; it is an alert, not a cap. Private account 782610231983 remains separate, with no account/chat migration.

## Setup on another machine

Use Node 24+, npm, Python 3.12 with pip and an authorized AWS profile. The core retrieval modules are vendored and pinned; the ignored SameClass reference clone is optional for further comparison, not a build dependency.

```sh
npm ci
python3 -m venv .venv
.venv/bin/python -m pip install -r research/requirements.txt pytest
npm run build:research
npm test
npm run test:research
npm run typecheck
npm run build
```

For local frontend development copy `web/.env.example` to ignored `web/.env.local` and fill the public shared deployment identifiers in STATUS.md; use its direct API Gateway URL locally. Production uses `/config.json`. Provider keys are server-side and aren't required for frontend-only development.

For authorized deployment, select your own CLI profile and set AWS_REGION=us-east-2, VIBE_AWS_ACCOUNT=851725603471, VIBE_AWS_REGION=us-east-2, VIBE_LOW_QUOTA=false. Then run strict synthesis, review the CDK diff and deploy. The private account requires different explicit flags and VIBE_LOW_QUOTA=true; do not mix them.

## Verification and limits

Final checks: **56 backend tests, 10 adapter tests, typechecks, production build and strict CDK synthesis passed**. The existing frontend bundle-size advisory remains. Earlier two-user/browser/source checks and cleanup recovery are recorded in docs/results/. Later Haiku question-scoping and tool-filter changes have focused fixture coverage and deployment/configuration verification, not a complete live recommendation-quality pass. The user elected to manually test and asked not to restart extra live recommendation evaluations.

Public sources are unofficial and can be missing/unavailable. Syllabus text extraction and fallback ordering have offline coverage; the checked live syllabus probe earlier returned not_found. RMP sample metrics are not complete course aggregates. Derived Supermemory abstractions with unverifiable inputs are withheld. Older synthetic PARTY_NOTES dead-letter jobs in the retained private account were left untouched. Broader ranking/language evaluation, physical-device/email-confirmation checks and conditional interactive browser research remain open. Read the specific result reports before making stronger claims.

No API keys, local AWS output, browser credentials, generated research wheels or ignored reference checkout are included in the handoff. The unrelated untracked Devpost thumbnail is excluded.
