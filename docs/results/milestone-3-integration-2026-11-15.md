# Milestone 3 integration verification — November 15, 2026

Target: Bhavesh's account `782610231983`, `us-east-2`, stack `Vibe-dev`, app https://d2fyk3jb2bpp2q.cloudfront.net. Anish's account is unchanged. No commit/push or submission was performed. The previously approved $10 initial testing allowance applies; actual billing totals have not been measured.

## Changes

- Party preferences use authenticated source authors and stable author/topic IDs, merging compatible updates into one topic record. The UI groups topic records under a named participant. Legacy single-author anonymous notes receive an attributed projection; new canonical topic records supersede those legacy rows without destructive migration.
- Preference owners control their preferences; manual-note authors control their notes; the party owner controls automatic shared notes. Authorization is enforced by the API. Correction attribution is labelled once. Source links and optimistic versions remain visible.
- Background automatic additions no longer invalidate every running answer. Manual corrections/deletions, membership changes and sharing changes retain their context checks. Historical answers are excluded after referenced versions change.
- Owner-only categorized profile previews use current canonical points with freshness/provider status. Supermemory buckets and filtered profile reads are integrated; unverified derived provider text is withheld. Group answers never reuse private aggregate profile summaries.
- Bounded persisted Bedrock tool exchanges invoke the IAM-only Python ASU/RMP adapter and TinyFish Search/Fetch. Responses retain citations, observation dates, partial-source warnings and unknown meeting information. Non-seat source results have a 15-minute public cache. Schedule comparison is deterministic over supplied normalized intervals.

## Local checks

48 backend tests, two Python adapter tests, workspace typechecks, frontend production build and strict CDK synthesis passed. The 53 existing upstream retrieval tests passed in the pinned reference environment earlier in this integration. The existing frontend bundle-size advisory remains.

Focused regressions cover source-bound ownership, topic consolidation, correction epochs, stale history, invalid extraction retry, ignoring unsupported context repetitions, canonical profile freshness, private/expired result rejection, older relevant points across class/trip/hackathon queries, conflicting constraints, oversized hard-constraint sets, unknown schedules, tool-result resume and the synthesis-only final turn.

## Live checks

The final combined scenario passed:

- Two independent Cognito identities and sourced decision/question extraction.
- Shared-note ownership, owner correction governing the next answer, and stale-edit rejection.
- Named participant preferences, one interests note after a new detail, and another member's edit rejected.
- Background preference extraction concurrent with successful answers.
- Categorized owner preview, other-owner isolation and immediate correction.
- Persisted successful ASU `search_classes` and deterministic `compare_group_schedules` tool results for Spring 2027 CSE 511.
- Persisted successful RMP professor identity lookup. The checked instructor was not confidently matched, and the answer retained that uncertainty. A separate bounded source probe resolved Tempe, returned five candidates and retrieved ten reviews; this does not establish the checked instructor's identity.
- General TinyFish research with persisted source citations.
- Two isolated Chromium sessions: sign-in, create/edit/remove notes, cross-user refresh, reload, and a 390px mobile viewport with no horizontal overflow.
- Same-member separate-party isolation, deletion and removed-member rejection.

Desktop/mobile screenshots were visually inspected. They show the corrected-note UI and sourced research responses; the scrollable panel does not show every preference card simultaneously. Browser fixtures use administrative Cognito provisioning with suppressed email, so inbox confirmation is not verified.

After all application assertions passed, the harness timed out waiting for the global memory queue during cleanup and exited nonzero. Scoped recovery removed 155 fixture records, two administratively generated users, two parties and their exact provider namespaces. The harness cleanup now uses canonical parent deletion plus an in-flight-write barrier instead of requiring unrelated queue work to drain; its syntax check passed. The complete scenario was not rerun after that harness-only adjustment. Two pre-existing PARTY_NOTES dead-letter jobs were left untouched. Final stack/queue state is recorded in STATUS.md.

## Important limits

Milestone 3B's broader global automatic personal-learning changes remain unimplemented. Party preferences do not silently become approved cross-party personal facts. Extraction remains mention-triggered and bounded to twenty recent messages; model classification and merging remain fallible. A reply can precede its background note update.

The preview has twelve canonical points. Provider-generated abstractions can remain processing/unverified and are withheld when their full inputs cannot be established. Focused canonical relevance checks are not a broad evaluation of live semantic ranking.

The checked public syllabus lookup returned not_found; successful live syllabus text extraction is not claimed. ASU and RMP interfaces are unofficial; reviews are bounded subjective samples. Schedule checks cover supplied intervals only and preserve missing meetings, prerequisites, labs, travel and enrollment eligibility as unverified.

No source interaction need was demonstrated, so asynchronous TinyAgent browser jobs remain a conditional follow-up. A physical-phone check, email signup confirmation and broader retrieval/language evaluation remain pending. Source provenance and build instructions are in research/README.md.

## Retest

1. Hard-refresh the deployed app and create a fresh class-planning party with two participants.
2. Each person states their own interests and class-time constraint. Mention `@Vibe, summarize each person's preferences.` Allow background notes to refresh.
3. Add another interest for the same person and mention Vibe again. Expect the same person's interests topic to update, with retained source links. Verify the other person has no edit/remove controls for it.
4. Correct your own constraint, then ask for ASU courses with a semester name/year, subject and course number. For example, Spring 2027 is term `2271`. Check sources, observation dates and uncertain meeting details.
5. Ask for professor identity/reviews and a general web-research question. Ambiguous professors or unavailable sources should remain explicit.
6. Open Personal memory, add/edit a private point, refresh the categorized preview, and confirm that another account cannot see it. Approved cross-party sharing remains a separate owner choice.

## Semester-name follow-up

User retesting exposed that the original tool prompt asked people for ASU internal term codes. The backend now adapts SameClass's deterministic semester resolver (same pinned revision), accepting names and years on every course tool and historical syllabus fallback. Spring 2027 maps to 2271, Summer 2027 to 2274, Fall 2026 to 2267, and Spring 2024 to 2241. Numeric codes remain supported for existing callers. Missing/relative semester names still require clarification; no year is silently selected.

Three focused regressions cover conversion, all course input shapes/fallbacks and invalid inputs; 51 backend tests and workspace typechecks pass. The agent-only update deployed successfully. A targeted live check passed using only a natural semester in the party goal: persisted ASU search completed, a cited URL used term 2271, and the response did not ask for an internal code. Reproduce with `VIBE_VERIFY_SEMESTER=true` using the same live script. The targeted script exited successfully; cleanup removed 17 fixture records, one synthetic user and its exact provider namespaces.
