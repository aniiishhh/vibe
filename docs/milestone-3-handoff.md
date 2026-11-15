# Milestone 3 handoff for Anish and Codex

**Milestone 3 is implemented and deployed** from `anish/implementation`. On November 15 Anish authorized finishing and deploying the remaining work without subagents. The update passed 25 focused memory checks, workspace typechecks, production build, strict synthesis and a bounded live two-user Haiku scenario. Read [the completion report](results/milestone-3-completion-2026-11-15.md) and STATUS.md for observed coverage. Milestone 4A/4B/4C is the next implementation work.

## Delivered

- Party-scoped attributed decisions/questions and preference cards, author/topic consolidation, restricted edits, correction epochs, provenance and stale-context guards.
- Owner-only categorized canonical profile previews with Supermemory bucket/profile integration, freshness/approval/version validation and private-summary exclusion from group context.
- Haiku 4.5 for replies/extraction, with different-model fallback disabled during evaluation; bounded persisted native tool execution and citations.
- ASU keyword/instructor/course searches and supported filters; natural semester conversion; level-filtered discovery; deterministic supplied-interval comparison.
- Current/historical same-professor syllabus lookup followed by labelled other-professor fallbacks, page excerpts and explicit source/coverage flags.
- RMP general and course-specific review samples, separate professor/sample metrics and bounded cursor pagination; TinyFish Search/Fetch.
- Current-question scoping, compact review evidence and duplicate-warning handling from manual feedback.

## Open work and ownership

**3B implementation and deployment are complete.** The worker accepts bounded self-descriptions without a pronoun gate, fans mentions out across eligible authors, paginates/continues work, consolidates same-party equivalent evidence and exposes extraction state in the owner screen. Owner-change barriers distinguish automatic revision advances from corrections and learning-control changes. Existing approval, sharing and tombstone protections remain in force. Read the updated STATUS.md and 3B plan for limits and verification.

The shared app now includes the API/dispatcher/memory-worker changes and frontend. The live scenario passed English pronoun-free and Spanish learning, quotation/third-party/temporary exclusions, equivalent-fact provenance consolidation, canonical correction and owner-profile isolation. ASU class research and TinyFish general research returned persisted citations. Mixed Hindi/English remains fixture-only coverage. Broad language/recommendation quality remains unmeasured.

Milestone 4A concerns contextual short replies/participation; 4B adds idle/timer learning for quieter users; 4C adds accepted tasks, modes and email. Their detailed plan is unchanged. Build 4A/4B on the deployed 3B extractor/cursor and owner-change barrier. Start by reading `backend/src/memory-worker.ts`, `backend/src/handler.ts`, `backend/src/memory-store.ts` and their tests. Party preference extraction is separate in `party-note-extraction.ts`; do not silently convert party preferences into approved global memories.

## Current deployment

App: https://d1ia555vbcj8k2.cloudfront.net. Stack Vibe-dev, account 851725603471, us-east-2, UPDATE_COMPLETE. API/dispatcher/memory/agent/research workers Active/Successful. Model: `us.anthropic.claude-haiku-4-5-20251001-v1:0`.

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

Final checks: **56 backend tests, 10 adapter tests, typechecks, production build and strict CDK synthesis passed**. The existing frontend bundle-size advisory remains. Earlier two-user/browser/source checks and cleanup recovery are recorded in docs/results/. The authorized completion update additionally passed 25 focused memory checks and bounded live English/Spanish personal-learning, consolidation, ownership, correction and cited ASU/TinyFish research checks. Broader recommendation quality and physical browser/mobile interaction were outside this completion scenario.

Public sources are unofficial and can be missing/unavailable. Syllabus text extraction and fallback ordering have offline coverage; the checked live syllabus probe earlier returned not_found. RMP sample metrics are not complete course aggregates. Derived Supermemory abstractions with unverifiable inputs are withheld. Older synthetic PARTY_NOTES dead-letter jobs in the retained private account were left untouched. Broader ranking/language evaluation, physical-device/email-confirmation checks and conditional interactive browser research remain open. Read the specific result reports before making stronger claims.

No API keys, local AWS output, browser credentials, generated research wheels or ignored reference checkout are included in the handoff. The unrelated untracked Devpost thumbnail is excluded.
