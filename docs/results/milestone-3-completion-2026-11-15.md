# Milestone 3 completion

November 15, 2026. Anish authorized deployment and completion of the remaining Milestone 3 work. Implementation stayed on `anish/implementation` with no subagents.

## Deployment

- App https://d1ia555vbcj8k2.cloudfront.net
- Stack `Vibe-dev`, account `851725603471`, region `us-east-2`
- Identity verified as Anish's IAM user using his local `default` profile
- CloudFormation update started at 10:54 UTC and reached `UPDATE_COMPLETE`. API, dispatcher, memory, agent and research functions were all `Active` / `Successful` afterward.
- Deployed the remaining 3B API/dispatcher/memory changes, rebuilt agent/research packages and frontend. CDK diff showed asset changes. Existing resources, model selection and secret references serve this update.
- Agent and extraction model remains `us.anthropic.claude-haiku-4-5-20251001-v1:0`.
- Public HTML and `/assets/index-DiVuByvQ.js` returned HTTP 200. The asset contains the extraction-state UI. Production config reports Ohio.

## Checks

The preceding implementation passed 25 focused memory tests, workspace typechecks and the web production build. Strict CDK synthesis passed before deployment. The existing bundle-size advisory remains. Earlier teammate evidence records 56 backend and 10 adapter tests. Those entire suites were not rerun for this bounded completion.

One live scenario used two temporary Cognito users, one isolated party and two @Vibe requests.

- English input without an initial first-person pronoun produced vegetarian and morning-class private candidates.
- Spanish self-descriptions produced vegetarian, morning-class and robotics candidates. Both authors were processed from one member's mention.
- Candidates retained the appropriate owner and self-authored source IDs. The initial candidate counts were two and three. Approval remained `candidate`.
- A fictional quoted skydiving claim, a friend's shellfish preference and a one-trip $175 budget were excluded from the author's personal candidates.
- TinyFish general research returned an answer with nine persisted citations after a request for the official Tempe public library website.
- A later equivalent vegetarian preference consolidated into the existing point, retaining its ID and adding the new source message to its provenance.
- ASU CSE 511 research for Spring 2027 returned an answer with five persisted ASU citations. The prompt also requested schedule comparison. This completion assertion checked the ASU citations. Deterministic comparison contracts retain their earlier focused/integration evidence.
- An owner edit changed the vegetarian point to vegan meals, and the owner profile immediately reflected the canonical correction. The other member's owner preview excluded it.

The source and research requests used normal authenticated API routes, deployed queues, workers and real Haiku calls. The frontend check verified served assets. A new browser-interaction or physical-device pass was outside this scenario.

## Cleanup

Two temporary Cognito users and 87 canonical fixture records were removed. Memberships were removed before the canonical cleanup. After a 95-second wait for in-flight worker writes, all fixture Supermemory namespaces were deleted successfully. The verification process exited successfully and its temporary token file was removed.

## Reproduce deployment

Use Node 24+, npm and Python with pip. Select your own authorized AWS profile and verify it resolves to account 851725603471. Runtime research wheels target Linux Python 3.12.

```sh
npm ci
npm run build:research
npm run build
export AWS_PROFILE=your-authorized-profile
export AWS_REGION=us-east-2
export VIBE_AWS_ACCOUNT=851725603471
export VIBE_AWS_REGION=us-east-2
export VIBE_LOW_QUOTA=false
npm run synth
npm run diff -w infra -- --no-change-set
npm run deploy -w infra -- --require-approval never
```

Deployment requires authorization for the current work. Existing SSM SecureStrings `/vibe/dev/supermemory-api-key` and `/vibe/dev/tinyfish-api-key` remain server-side. Another developer needs public frontend identifiers from STATUS.md and their own AWS credentials. Provider keys are unnecessary for frontend-only development.

## Next work and limits

Milestone 4A adds contextual participation from short replies. Milestone 4B adds idle/time-triggered learning for quieter users. Milestone 4C adds tasks, modes and email invitations. Their detailed plan is preserved.

The live language evidence covers specific English and Spanish examples. Mixed Hindi/English retains mocked-provider input coverage. Broad semantic accuracy, recommendation quality, every source/filter combination, physical-device behavior and inbox confirmation remain unmeasured. Syllabus extraction/fallback still has fixture coverage and the earlier live not-found result. Interactive browser research remains conditional on a source needing interaction. These limits are retained for the demonstration/hardening work.
