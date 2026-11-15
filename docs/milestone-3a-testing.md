> Historical 3A test guide. Current deployment and ownership rules are in [STATUS.md](../STATUS.md) and the [handoff](milestone-3-handoff.md). The shared Haiku app is https://d1ia555vbcj8k2.cloudfront.net. Preferences are editable by their owner, manual notes by their author, and automatic shared notes by the party owner. 3C/3D are now implemented; 3B remains open. Descriptions below record the earlier checkpoint, not current acceptance.

# Milestone 3A: party memory checkpoint

Implemented locally on `codex/milestone-3-party-memory`, based on Anish's `41d6318`. This is the first part of Milestone 3, not a claim that the complete milestone is finished. The feature is now deployed in Bhavesh’s separate account at https://d2fyk3jb2bpp2q.cloudfront.net. See STATUS.md for final live verification.

## What changed

- Members can add, edit and remove party-scoped notes in the existing Party memory panel.
- Notes carry decision/suggestion/constraint/question/disagreement type, source links, contributor attribution, timestamps and versions. Optional expiry is supported by the API and displayed in the panel.
- An @Vibe message durably enqueues a separate `PARTY_NOTES` job. The existing worker extracts at most five notes from at most twenty recent messages, bounded by the trigger. Personal learning settings are unchanged; group notes summarize shared party discussion.
- Only ordinary human discussion in the same party can support extracted notes. Direct @Vibe prompts trigger extraction but are excluded as factual evidence, so a reminder request cannot become a new unresolved group question. Current canonical notes are also provided as extraction context. A decision citing just one author is downgraded to a suggestion. Semantic agreement still depends on model quality; inspect and correct automatic notes.
- Exact normalized repeated text/type is consolidated. Stored extraction batches and deterministic IDs deduplicate retries. Supporting messages from the first saved note are retained; semantic paraphrase consolidation remains future work.
- Corrections/deletion use optimistic versions and atomic membership, note, revision, audit-history, source-suppression and refresh writes. Deleted notes remain tombstoned.
- A correction advances the extraction epoch, preventing pre-correction messages and delayed batches from restoring old notes. This conservatively skips other unsummarized messages from older epochs; those messages remain in chat, and members can manually record a still-relevant note.
- Agent context checks party note revisions, suppresses corrected source spans in both recent chat and provider history, and drops stale assistant replies. Current canonical notes are used even while provider indexing lags. Notes are canonical DynamoDB records; existing conversation indexing remains the Supermemory historical path.
- Separate FIFO groups keep note-model failures from blocking conversation indexing. Extraction occurs asynchronously; the response to the triggering mention may precede saved notes. Test recall with a subsequent mention after the notes appear.

## Run automated checks

Use Node 24. The local development session used a temporary Node 24 runtime without installing global tools.

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run synth
```

The focused new tests are `backend/test/party-notes.test.ts`; run `npm test -w backend -- test/party-notes.test.ts` to select them. They use mocked application storage and model responses; they do not establish deployed DynamoDB or Bedrock behavior.

## Browser test after authorized deployment

Anish's original deployed URL still runs his existing backend. Bhavesh's new deployment includes the party-memory changes. Merely running the new frontend against it will not enable the new note mutation routes or extraction job. Deploy the API, memory worker, dispatcher, agent and frontend together before testing this workflow.

1. Sign in as A and invite B to a test party. Use independent browser profiles.
2. A writes “I suggest meeting Friday at 3 PM.” B writes “Yes, Friday at 3 PM works; let's meet then.” Add “Which room should we use?”
3. Mention “@Vibe, capture our meeting decision and unresolved questions.” Open Party memory. Wait for asynchronous extraction and refresh. Expect a sourced decision and a room question; inspect every source and classification.
4. Reload. Both users should still see the notes. A single author's proposal must remain a suggestion.
5. Edit Friday to Saturday, save, and ask @Vibe on the next message when the meeting is. The answer must use the corrected note. The UI should show the new version/editor.
6. Start editing the same note in both browsers. Save A's edit, then B's stale edit. B must receive a conflict and reload; A's change must remain.
7. Remove a note. Reload and retry the same extraction batch in an authorized integration test. It must not reappear. A member may intentionally add a new manual note.
8. Create another party with the same members. Its note list must stay separate. A non-member must receive authorization errors from the first party's note routes and source-history reads.
9. Check mobile layout and UI errors after any fixes. Record live observations in STATUS.md.

Optional expiry can be tested through an authenticated API request. It is not editable in the current note form. Broader personal learning, Supermemory bucket summaries and research tools remain Milestone 3B–3D work.

## AWS target

`infra/bin/app.ts` supports `VIBE_AWS_ACCOUNT` and `VIBE_AWS_REGION` overrides while preserving Anish's default. Bhavesh selected account `782610231983` and has a local `vibe-dev` profile. The previous Bedrock denial is resolved: a readiness probe and real application replies passed. The user approved $10 for initial setup/testing, CDK bootstrap completed and the Supermemory key was provisioned to SSM SecureString. TinyFish is still local and unused in 3A. The account has only ten concurrent Lambda executions; include `VIBE_LOW_QUOTA=true` in all synthesis/diff/deploy commands for this account. Local `.env` keys are not automatically uploaded to SSM.

Deployment was authorized in this chat and performed in account 782610231983. Anish’s stack was not changed. The current local AWS login is still root; use a developer identity for routine work. Deployment commands must explicitly select the account/profile/region and low-quota flag above.

## Reproduce the live smoke test

```sh
AWS_PROFILE=vibe-dev AWS_REGION=us-east-2 VIBE_URL=https://d2fyk3jb2bpp2q.cloudfront.net node --env-file=.env scripts/verify-party-memory.mjs
```

This creates synthetic Cognito users without sending email, exercises the real API/model and cleans up fixture users, table records and party namespaces. It uses paid provider calls; run intentionally. To include the browser portion, provide `VIBE_PLAYWRIGHT_MODULE` pointing at an installed Playwright module and its matching `PLAYWRIGHT_BROWSERS_PATH`. The development session used temporary tooling under `/private/tmp/vibe-browser-tests`. No browser dependency was added to the repository.

The script validates independent users, sourced decision/question extraction, correction-aware answers, stale-edit conflicts, party isolation, member removal and deletion. The optional browser portion checks desktop/mobile sign-in, note creation/edit/deletion across sessions, reload and horizontal overflow at 390px. It does not test email inbox delivery or establish broad multilingual extraction quality.
