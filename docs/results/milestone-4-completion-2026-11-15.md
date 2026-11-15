# Milestone 4 completion

November 15, 2026. The user authorized implementation, deployment and bounded verification on `anish/implementation`. No subagents were used.

## Deployment

- App https://d1ia555vbcj8k2.cloudfront.net
- Account `851725603471`, region `us-east-2`, stack `Vibe-dev`
- Stack `UPDATE_COMPLETE` after the 11:22 UTC update. API, agent, dispatcher, memory and research functions all reported `Active` / `Successful`. Research retains the previous Milestone 3 package.
- Updated API/agent/dispatcher/memory packages and frontend. Expanded the in-place DynamoDB stream filter to include inserted human messages. Expanded scoped dispatcher permissions for pending markers and scheduler transactions. Added SES/SSM permissions scoped to the configured sender.
- Existing EventBridge recovery rule is enabled with `rate(5 minutes)` and now discovers eligible background memory work.
- SES sender verification succeeded. The user-selected sender address lives in SSM String `/vibe/dev/invite-sender`. Existing Supermemory/TinyFish SecureStrings and the Haiku 4.5 model remain configured.

## Delivered behavior

### Contextual participation

Human messages can reference an explicit earlier message. Extraction has at most forty human sources and 12,000 source-text characters, with bounded recovery of older linked proposals. Context retains IDs, authenticated authors, party, timestamps and reply links. Party participation records preserve suggested, confirmed, unresolved and withdrawn states, response/proposal provenance and current versions. Current membership, source access, note epochs and deletion/correction guards apply.

Personal extraction can consult bounded surrounding context while retaining self-authored durable evidence. Joining one activity stays party-scoped. Task acceptance remains an authenticated application action.

### Quiet-user learning

Message-stream handling maintains monotonic party and per-author pending markers. Discovery requires two minutes of party inactivity. An atomic claim enforces at most one timer batch per party per five minutes and increments a persisted party usage counter.

A batch handles one eligible author's pending messages plus one shared contextual-notes phase. Existing twenty-message author batches, forty-message context, 12,000-character source-text budgets, validation retries and worker deadlines apply. Longer backlogs and additional authors remain pending for later ticks. Mention/count triggers share cursors, and covered/empty work skips model inference. Candidate writes still recheck revision, learning controls, ownership, membership and tombstones.

Automatic candidates remain private pending owner approval and per-party sharing opt-in. Background extraction sends no unsolicited chat reply. Personal extraction state and failures remain visible in the memory screen. Model request/token metadata is logged without conversation text.

### Tasks, modes and invitations

Tasks support persistent proposals, version histories and revised proposals, authenticated self-accept/claim/decline/complete actions, stale-version rejection and renewed acceptance after revisions. Mutations and native agent proposal tools record action results for replay. Task tools create proposals. They cannot accept or complete assignments for another person.

Party owners choose Focused, Friendly or Banter with optimistic versions. The deployed agent receives the selected tone instruction, current member identities and current tasks.

Application invitations use SES with an existing seven-day join link and a persisted send record. Repeated client IDs return the recorded result. An uncertain SES timeout is preserved as uncertain delivery, avoiding blind duplicate sends. The UI reports availability and delivery status.

SES remains in sandbox mode. Eligible recipients are individually verified email addresses, the SES mailbox simulator, and addresses at verified domains. Arbitrary recipients require AWS production access. This milestone did not request account-wide production access or establish arbitrary-recipient inbox delivery.

## Verification

**77 backend tests passed**, including twelve new focused Milestone 4 cases. Workspace typechecks, production build, strict synthesis and whitespace checks passed. The existing frontend bundle-size advisory remains. The UI detector returned no findings for changed targets.

One bounded live scenario used two temporary Cognito users and one party.

- Saved two eligible own statements, fewer than ten, with no @Vibe mention. A second, learning-disabled member proposed camping and posted a fictional quoted agreement.
- After the actual two-minute idle threshold, the check explicitly invoked the scheduled-handler path. At **141 seconds** after the final message, two private candidates and a confirmed participation record were visible. The enabled EventBridge schedule was independently checked. Ordinary discovery can take about two to seven minutes after inactivity plus queue/provider latency.
- The idle batch made **two successful model requests**. Personal extraction used 756 input / 127 output tokens; shared contextual extraction used 2,632 input / 380 output tokens. Total **3,388 input / 507 output tokens**. These counts apply to that idle batch.
- The camping record linked the participant's own short response to the proposal. The fictional quotation established no participation. The disabled learner gained no private candidates. Joining camping created no reusable camping preference and no unsolicited assistant reply.
- Task checks passed reload, repeated proposal identity, wrong-user acceptance/completion rejection, stale versions, material revision, mandatory re-acceptance and completion.
- Focused, Friendly and Banter all persisted. Non-owner and stale setting updates were rejected.
- A real application invitation was accepted by SES for `success@simulator.amazonses.com`. Repeating the same send ID returned the persisted sent result.
- A single later @Vibe request created a native tool-backed unassigned task. It remained proposed until the authenticated user claimed it.
- A later sourced response updated the same camping participation record to withdrawn.
- Desktop browser sign-in, task controls and the stored mode passed. The 390px viewport check found no horizontal overflow. This was a bounded render check; full mobile/device flows remain in Milestone 5.
- After removal, the second user was rejected from task and party-memory reads.

Focused fixtures additionally cover competing unresolved proposals, older explicit reply recovery, stale participation responses, removed source authors, task action replay, pending-marker monotonicity, discovery eligibility and persisted rate guards. These fixtures exercise state/source contracts. Broad semantic ambiguity quality and every concurrency/failure combination were outside the live scenario.

## Cleanup

Removed both temporary Cognito users, 92 canonical fixture records and every fixture Supermemory namespace. Canonical memberships/records were removed before the provider cleanup, followed by a 95-second wait for in-flight writes. The verification process exited successfully and removed its temporary token file. No shared queue was purged.

## Setup on another device

Use the existing setup in STATUS.md. Install locked dependencies with `npm ci`, prepare the research asset with `npm run build:research`, and build the frontend with `npm run build`. Select an authorized profile and verify account 851725603471 before AWS changes.

Set `AWS_REGION=us-east-2`, `VIBE_AWS_ACCOUNT=851725603471`, `VIBE_AWS_REGION=us-east-2`, and `VIBE_LOW_QUOTA=false`. Run strict synthesis, inspect `npm run diff -w infra -- --no-change-set`, and deploy only with authorization for the work.

The shared account already contains `/vibe/dev/invite-sender`. In a new account, verify a SES sender in the selected region and create that non-secret String parameter before deploying the sender-scoped policy. Provider keys remain server-side in the existing SecureStrings. Frontend-only development uses public config values from STATUS.md.

The initial timing policy is controlled by `MEMORY_IDLE_SECONDS` (120) and `MEMORY_BACKGROUND_INTERVAL_SECONDS` (300) in scheduled discovery. The worker independently rechecks the idle period with the same 120-second default. Change both idle configurations together through infrastructure when altering this policy.

## Next work

Milestone 5 integrates the user-designated `anish/ui` branch, including mascot, themes, backdrops and interactions. Reviewed source revision `5971cd76de3f6c0c72e6f81975da962017e64754` is a checkpoint; fetch the latest branch before merging. Preserve current reply/source links, participation, task state transitions, tone settings, email availability and all existing memory/research behavior. Add the remaining mobile/demo/submission work from the plan.
