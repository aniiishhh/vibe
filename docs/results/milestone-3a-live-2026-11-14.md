# Milestone 3A live verification

November 14, 2026, America/Phoenix. Branch `codex/milestone-3-party-memory`.

Deployment: https://d2fyk3jb2bpp2q.cloudfront.net, account `782610231983`, region `us-east-2`, stack `Vibe-dev`. Initial creation completed, followed by a memory-worker-only update. Anish's separate account/stack was unchanged. The user approved $10 for initial setup/testing; this is an allowance, not an enforced AWS billing cap. Actual billing totals were not measured.

## Final live scenario

The script `scripts/verify-party-memory.mjs` used two administratively provisioned synthetic Cognito users with email sending suppressed. The browser checks ran Chromium in independent desktop and 390px contexts. The final complete run passed:

```text
PASS independent Cognito identities
PASS sourced decision/question extraction and member reload
PASS correction controls the next AI answer; stale edit rejected
PASS browser sign-in and corrected note in both sessions
PASS browser note creation propagated to the other session
PASS two isolated browsers: note create/edit/delete, cross-user refresh, reload and 390px layout
PASS deletion, same-member party isolation and removed-member rejection
PASS fixture cleanup (60 records, 2 users)
```

The test covered real model extraction of a two-author meeting decision and an unresolved room question, source IDs, both members reloading notes, a member correction controlling the next real AI answer, stale-version rejection, note CRUD in both browsers, refresh/reload, no horizontal overflow at 390px, deletion, same-member party isolation and removed-member rejection. Model classification was checked in this synthetic scenario; broader quality is not established.

Screenshot review found an earlier extractor treating an @Vibe reminder as a new unconfirmed question. The fix excludes direct @Vibe prompts from factual evidence and supplies current canonical notes as extraction context. A unit regression and the entire live API/browser scenario passed after deploying that fix. Initial browser harness errors involving email case and exact form-label matching were corrected; these did not require application changes.

Local verification: 32 backend tests, workspace typechecking, production frontend build and CDK synthesis passed. Browser screenshots are under ignored `output/playwright/party-memory-desktop.png` and `party-memory-mobile.png`; they were visually inspected. The existing frontend bundle-size advisory remains.

All fixture users and party namespaces were removed after each run. The final run removed 60 fixture table records and two users; twelve orphan rate counters from deleted fixture parents were removed separately. The reusable script now includes rate-counter keys in its cleanup selection. No provider keys or generated passwords/tokens are included in this report. The agent and memory DLQs were empty at the verification checkpoint.

## Remaining limits

- Email inbox delivery and user-entered confirmation codes were not tested; accounts were created administratively.
- This was a simulated mobile viewport, not a physical-phone test.
- Exact extraction retry/tombstone cases are covered by local tests; this run did not explicitly redeliver SQS work.
- Optional expiry exists in the API and display, but the note form does not edit expiry.
- At most twenty recent messages per mention are inspected. Direct @Vibe prompts are triggers rather than source evidence; record actual facts in ordinary discussion or add a manual note.
- A correction conservatively skips pre-correction epochs for future extraction. Human review remains necessary for inferred note classification.
- Broader personal learning, bucket summaries and research tools remain Milestones 3B–3D.
