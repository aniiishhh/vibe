# Vibe status and teammate handoff

Updated November 15, 2026, America/Phoenix. Handoff target: `anish/implementation`.

## Semantic party-theme selection deployed

The latest user request replaces keyword matching with semantic selection from the party name and goal. New parties make one bounded Haiku Converse request during creation and persist a validated theme ID plus model/fallback provenance. All members receive the same saved automatic theme for backgrounds and Pip. The API role gains the same scoped Haiku inference-profile/destination permissions used by the workers. Requests allow at most 32 output tokens, one SDK attempt and an eight-second abort signal. If classification fails, creation saves Everyday with visible fallback status. Admins can choose/retry a theme from Details for existing parties. An explicit reclassification failure preserves the previous saved selection.

The frontend keyword lists/scorer were removed. Unsaved/older parties display Everyday until an admin selects their theme. Personal overrides still apply over the saved automatic theme. Creation shows a choosing-theme state. 86 backend checks, workspace types, build, strict synthesis, reviewed CDK diff and UI detector passed. Deployed to shared account 851725603471 / us-east-2 with the verified default profile. Stack UPDATE_COMPLETE, API Active/Successful, and the public homepage references the latest production bundle. The update changed API model permissions/environment, API/agent/dispatcher/memory assets and frontend assets. A final API-only deployment refined the activity-vs-logistics classification instruction.

Bounded deployed-Lambda checks used real Haiku and DynamoDB with isolated synthetic claims. A misleading “Launch party” name with an eigenvector/proof-learning goal selected Studies, persisted and reached another member. Non-admin reclassification was rejected. A legacy-shaped Spanish nature outing was initially classified Travel, prompting a semantic instruction clarification. The final deployed prompt classified that same forest/stars/trails goal as Outdoors and persisted it. The final creation took 1,764 ms including Lambda/database work. These are observed examples, with broader classification quality unmeasured. Three model calls were made across both checkpoints. All eleven temporary canonical fixture rows were removed, with no messages/provider memory created. The authenticated browser creation wizard was not repeated. Initial implementation checkpoint is `92fe627`.

On another device use the shared deployment instructions below. The API needs MODEL_ID and the documented scoped Bedrock inference-profile and US destination-model permissions. Theme fields are additive and require no database migration. Existing parties receive semantic selection through the admin Details action.

## Party management and mascot update deployed

November 15 user-requested update implements per-user archive/restore, self-leave, multiple admins with promote/demote/remove controls, admin-only Vibe mode changes and manual shared notes, creation-time mode selection and optional invitation setup. Existing owner memberships retain admin privileges. Membership-revision transactions prevent concurrent role/removal/join changes from abandoning a populated party. The last admin must appoint a successor before leaving a populated party. The last person leaving closes the empty party to old invitations. Personal preference/participation corrections remain subject-owned.

Mascot positioning now runs after parent DOM refs attach, reruns when enabled and observes container size changes. Pip is bundled with the app to remove the deferred invisible loading boundary. The celebration hat is reduced to its original drawing scale. A local StrictMode browser fixture passed first mount, unmount/remount and hide/show, and celebration/study/travel rendering was visually checked. This adds roughly 14 KB gzip to the initial bundle compared with the preceding lazy build. Existing Vite bundle-size advisory remains.

83 backend tests passed, workspace types, production build, strict synthesis and reviewed CDK diff passed, and the UI detector reported no findings. Deployed to shared account 851725603471 / us-east-2 using the verified `default` profile. `Vibe-dev` reached UPDATE_COMPLETE. API is Active/Successful and retains `APP_URL=https://vibe-chat.us`. Updated API/agent/dispatcher/memory code assets and frontend assets. Public homepage references the new bundle, and its downloaded bytes match the local production asset.

A bounded direct invocation of the deployed API handler with three isolated synthetic user claims passed creation-time mode, invitation joins, non-admin rejection for role/mode/note/removal writes, multiple admins, shared-note correction by a second admin, per-user archive persistence and restoration, admin removal and removed-member rejection, creator self-leave with admin succession, last-admin demotion rejection, sole-member exit and closed-party invitation rejection. Sixteen temporary canonical rows were removed. No Cognito accounts, messages or provider memory were created, and no model calls were made. This check exercises real Lambda/DynamoDB transactions. Cognito/API Gateway login, the full creation wizard in an authenticated browser, and email delivery were not repeated. The browser fixture covers mascot rendering/recovery, with broader mascot-state/device coverage still limited.

Code checkpoint is `a5f9a6c`. Future devices use the existing shared-account setup/deployment steps below. Archive flags live on membership rows, owner/admin roles are backward-compatible, and no database migration or new infrastructure resource is required.

## Custom domain deployed and public DNS verified

The user authorized connecting **vibe-chat.us** through Porkbun on November 15. The certificate validation CNAME is publicly visible and ACM reports **ISSUED** in us-east-1. The shared `Vibe-dev` stack reached **UPDATE_COMPLETE** and CloudFront `E2CC4LLGDDIPFE` reports **Deployed**, with `vibe-chat.us` attached and TLSv1.2_2025 configured. API `APP_URL` is now `https://vibe-chat.us` and its update succeeded. Persistent context in `infra/cdk.json` retains the domain/certificate on future deployments.

Infrastructure typechecking, strict synthesis and reviewed CDK diff passed. Before DNS cutover, verified HTTPS using the custom hostname/SNI routed directly to the CloudFront endpoint. Certificate validation passed, homepage and invite SPA route returned 200 with identical app HTML, `/config.json` returned the shared settings with relative `/api`, and unauthenticated `/api/parties` returned the expected 401. Authenticated sign-in and actual email delivery were not repeated for this infrastructure change.

The user replaced the Porkbun root parking ALIAS with `d1ia555vbcj8k2.cloudfront.net`. Both authoritative Porkbun DNS and public resolver 1.1.1.1 now return CloudFront addresses. Using a freshly published public address with the original hostname/SNI, HTTPS certificate verification passed, homepage and invite SPA returned 200 with matching app HTML, `/config.json` returned the shared configuration, and `/api/parties` returned expected unauthenticated 401. The local operating-system resolver still cached a parking address during verification, so ordinary access can vary until caches refresh. Canonical website is **https://vibe-chat.us**. The original CloudFront URL remains available. Authenticated sign-in and email delivery retain the prior checks. See [exact DNS records and replication steps](docs/aws/custom-domain.md).

## Milestone state

**Milestone 3 is implemented and deployed** on the shared app from `anish/implementation`. The user authorized completion and deployment on November 15. A bounded two-user live Haiku scenario passed the remaining 3B acceptance checks, general TinyFish research and ASU class research. Milestone 4 is also implemented/deployed and verified below. The requested Milestone 5 UI integration and README are complete below; the other Milestone 5 tasks are deferred. See [the completion report](docs/results/milestone-3-completion-2026-11-15.md) for exact coverage and limits.

### Milestone 5 requested UI and README scope completed

The user authorized UI integration/deployment and a professional README with website images and the supplied AWS diagram. Other Milestone 5 work remains deferred. Milestone 4 was committed/pushed first as `c622f3b`. UI integration was committed/pushed as `6b1d25f`, demonstration-only removal as `bd0a2c7`, and the README/assets as `34ccb2f`.

The current deployed frontend integrates `anish/ui` revision `5971cd76de3f6c0c72e6f81975da962017e64754`. Pip, mentions, light/dark/system themes, contextual backdrops and its details-panel layout are integrated with the live APIs. The original title/goal keyword rules are superseded by the semantic selection update above. The saved automatic theme drives matching mascot accessories, with an optional per-device background override. Canned parties/profiles/replies, simulated run timers, mock sign-in, preview switches and the mascot playground were removed from the application.

Reply/source links, citations, editable/versioned notes and participation, task actions, modes, SES availability, approved sharing and owner-only memory views remain connected to canonical state. The categorized owner preview follows the same theme. Source links load bounded older history when necessary.

The latest frontend-only deployment reached UPDATE_COMPLETE after 11:54 UTC (4:54 AM Phoenix). Backend resources, model and service configuration retain the Milestone 4 deployment. Production serves the new website assets. Memory and mascot modules are lazy-loaded; message rows and the mascot are memoized; mascot polling skips hidden/disabled states. The main application bundle still has the existing Vite size advisory.

Workspace/frontend types, production build, strict synthesis and the UI detector passed. A real two-account fixture produced an ASU-sourced reply with five citations. Live browser checks passed sign-in, AppSync subscription, study-theme selection, Pip visibility, typing with zero observed >50ms long tasks, reply source IDs, task acceptance/persistence, party modes, editable notes, sharing, link/QR invitations, SES availability, memory approval, categorized owner preview and dark-mode persistence. At 390px the composer worked without horizontal overflow. Desktop, dark memory and compact screenshots were visually inspected. Two screenshot passes stopped at an exact-label browser locator while the note editor was visible; the scoped textarea locator was corrected and the remaining checks passed without repeating model research.

The professional [README](README.md) includes four images from temporary records in the actual deployed application and the user-supplied architecture PNG. Relative document/image links, PNG integrity and the architecture image's byte-for-byte preservation were checked. Both temporary Cognito users and all three fixture passes' canonical/provider data were removed (56, 34 and 38 canonical record deletions respectively). No queue was purged. Temporary credential files were removed.

Continue only with newly requested work. The user's deferred Milestone 5 tasks are still identified in the plan. SES remains sandboxed and broad performance/device/source-quality evaluation retains its earlier limits. See [UI integration evidence](docs/results/milestone-5-ui-integration-2026-11-15.md).

### November 15 Milestone 4 completion

The user authorized full Milestone 4 implementation, deployment and bounded verification. `Vibe-dev` reached UPDATE_COMPLETE after the 11:22 UTC update. API, agent, dispatcher, memory and research functions are Active/Successful. This update deployed API/agent/dispatcher/memory packages and frontend assets, expanded the source-message stream filter and scoped dispatcher/SES permissions, and reused the enabled five-minute recovery schedule. Existing account, Ohio endpoints, Haiku model and provider secrets serve this milestone.

- **4A** adds explicit message replies and bounded multi-author context with older linked proposals, party-scoped suggested/confirmed/unresolved/withdrawn participation, sourced ownership, owner corrections and stale-response/tombstone guards. A one-time agreement stays outside durable personal preferences.
- **4B** adds monotonic stream-maintained party/author pending markers, two-minute inactivity eligibility and discovery on the existing five-minute schedule. A party gets at most one timer batch per five minutes, enforced transactionally with a persisted batch counter. Each batch handles one eligible author and a shared contextual-notes phase. Longer author backlogs stay pending for another tick. Mention/count triggers reuse the same canonical cursors. Empty/covered work skips model calls.
- **4C** adds persistent task proposals and version histories, owner/proposer revisions, authenticated self-accept/claim/decline/complete actions, renewed acceptance after material edits, and recorded-action replay. Native agent tools can propose tasks and revisions. They cannot accept assignments for people. Party owners choose Focused/Friendly/Banter with version guards.
- Application email invitations read a verified user-selected sender from SSM String `/vibe/dev/invite-sender`. Real SES sending and recorded-result replay passed with the mailbox simulator. SES remains in sandbox mode. The app explains permitted recipients and reports failed/uncertain delivery. A timeout preserves uncertainty to avoid automatic duplicate sends. Arbitrary-recipient delivery requires separate SES production access. No production-access request was submitted.

**77 backend tests**, workspace types, production build, strict synthesis and deployment passed. The UI detector found no issues in the changed targets. One two-user live scenario passed task persistence/idempotency/permissions/version transitions, all three mode settings, actual SES simulator sending, quiet-user candidates, source ownership, quoted-agreement exclusion, contextual participation and withdrawal, native agent task proposals, authenticated claims, owner previews and removed-member rejection. Desktop browser task controls and the stored mode were checked. The 390px viewport check found no horizontal overflow. Full mobile/physical-device coverage remains in Milestone 5.

Quiet learning produced two private candidates **141 seconds** after the last human message, with no @Vibe mention and fewer than ten own messages. The completion check invoked the actual scheduled-handler path after the real two-minute idle period. Its enabled EventBridge rule remains `rate(5 minutes)`, so ordinary eligible discovery can take approximately two to seven minutes after the final message, followed by worker/provider latency. The observed idle batch made **two successful model requests** with **3,388 input / 507 output tokens** across personal and shared-context extraction. The learning-disabled member gained no private candidates, and joining camping created no reusable camping preference.

Both temporary Cognito users, 92 canonical fixture records and all fixture Supermemory namespaces were removed. Provider deletion followed the 95-second in-flight-write wait. See [the completion report](docs/results/milestone-4-completion-2026-11-15.md).

The user named `anish/ui` as the UI/mascot source. Milestone 5 explicitly integrates that branch's themes, backdrops, mascot and interactions with the current feature APIs. Milestone 4 adds functional controls within the existing components and styling. The reviewed UI branch revision is `5971cd76de3f6c0c72e6f81975da962017e64754`; fetch its latest revision before integration.

### November 15 Milestone 3 completion

- Removed the English-pronoun prefilter. Bounded author-only model input handles self-descriptions and paraphrases, with explicit quotation, third-party and temporary-constraint exclusions.
- Every @Vibe mention creates paginated personal-extraction work for current learning-enabled members, including when the mentioning member has learning disabled. Fanout pages contain at most ten members. Each author gets a separate job and source window.
- Scans examine at most 300 chat rows per job and carry sparse pending sources forward. Extraction takes at most twenty own messages and 12,000 source-text characters, with up to five facts and the existing bounded two-attempt model call. Count-triggered jobs retain the ten-message threshold. Cursor advancement and remaining-work outbox writes commit together.
- Added an owner-change revision barrier. Automatic candidate creation can advance revisions without losing the rest of a backlog. Owner edits, deletion and learning-setting changes move the barrier, preserving stale-job protection. Existing profiles use a conservative baseline until their next owner change or candidate creation.
- Equivalent facts can consolidate same-party source IDs while retaining the owner's text, approval and fact version. Merging is conditional on the profile revision and fact version. Source tombstones still suppress paraphrased retries. New-party evidence remains a separate sourced candidate because the current fact contract has one source party. Consolidation considers the newest forty active points and preserves overflow evidence as separate candidates.
- The owner memory API/screen exposes pending, processing and extraction-error state and refreshes while work is pending. Temporary budgets/availability stay in party notes with expiry when the source supplies a definite end. Quiet-user idle scheduling and contextual participation remain Milestone 4 work.
- **25 focused memory tests passed**, workspace TypeScript checks passed and the production web build passed. Existing bundle-size advisory remains. English variants, Spanish and mixed Hindi/English reached isolated model input in mocked-provider fixtures. These checks verify routing, prompts, bounds, sources and state behavior. The subsequent live Haiku scenario passed English pronoun-free and Spanish extraction, two-author ownership, quotation/third-party/temporary exclusions, equivalent-meaning consolidation and canonical correction/profile isolation. Mixed Hindi/English retains fixture-only coverage.
- Deployed API, dispatcher, memory, agent and rebuilt research packages plus frontend assets. Strict synthesis and CDK diff passed. The stack reached UPDATE_COMPLETE after the 10:54 UTC deployment, and all five functions were Active/Successful. The public app and updated JavaScript asset returned HTTP 200. Existing resources and configuration serve this update. Replicate setup using the instructions below.

Completion cleanup succeeded. Both temporary Cognito users, 87 canonical fixture records and all fixture Supermemory namespaces were removed after the in-flight-write wait. Detailed evidence and deployment replication steps are in the completion report.

| Part | Current state |
| --- | --- |
| 1 and 2 | Implemented/deployed; earlier acceptance and limitations are retained in the historical reports. |
| 3A party memory | Implemented/deployed: sourced shared notes, named author/topic preferences, owner/author controls, corrections, tombstones and context guards. |
| 3B broader personal learning | Implemented/deployed. Focused checks and bounded live English/Spanish learning, ownership, consolidation and correction scenario passed. |
| 3C profiles/retrieval | Implemented/deployed: owner-only categorized canonical previews, provider freshness, validated shared retrieval and correction fallback. Unverifiable provider prose is withheld. |
| 3D research | Implemented/deployed: bounded ASU/RMP/syllabus/TinyFish tools, native Haiku tool loop, citations, schedule comparison and source/coverage labels. Latest shared Haiku ASU class lookup and general TinyFish citation checks passed. Broad recommendation-quality evaluation remains outside the bounded check. |
| 4 | Implemented/deployed. 77 backend tests and bounded live two-user checks passed for contextual participation, quiet learning, tasks, modes and SES simulator invitations. |
| 5 requested scope | `anish/ui` integrated and deployed, demo logic removed, professional README/images/architecture added. Other Milestone 5 tasks deferred by the user. |

Read [the handoff](docs/milestone-3-handoff.md) and [implementation plan](docs/implementation-plan.md) before continuing. Milestone 4 builds on those 3B cursors. The requested UI/README integration is complete. Other Milestone 5 work requires a new user request.

## Current shared deployment

**https://vibe-chat.us** — stack `Vibe-dev`, account **851725603471**, **us-east-2**, **UPDATE_COMPLETE**. Latest deployment updated API/dispatcher/memory/agent code and frontend assets for chat organization, admin permissions and mascot fixes. The preceding domain update attached the certificate and set the canonical API invitation URL. Scoped runtime permissions retain Milestone 4 and the research package retains Milestone 3. All five functions are Active/Successful. Agent and memory workers use **us.anthropic.claude-haiku-4-5-20251001-v1:0**. Different-model fallback is disabled for evaluation. Anthropic first-use setup and a real READY invocation succeeded before the shared model switch.

| Setting | Value |
| --- | --- |
| API Gateway | https://b8cojfsw6f.execute-api.us-east-2.amazonaws.com/api |
| Cognito pool | us-east-2_zrHcAFg7r |
| Cognito public client | 2q4vsdoqv1037okr9s3ivm8lim |
| Events HTTP | https://ged5txwgabfzpcqjmkazypa5s4.appsync-api.us-east-2.amazonaws.com/event |
| Events realtime | wss://ged5txwgabfzpcqjmkazypa5s4.appsync-realtime-api.us-east-2.amazonaws.com/event/realtime |
| DynamoDB table | vibe-dev |
| FIFO queues | vibe-dev-agent.fifo / vibe-dev-memory.fifo in this account |
| Research Lambda | vibe-dev-research, Python 3.12 x86_64, IAM invocation only |
| Provider credentials | SSM SecureStrings /vibe/dev/supermemory-api-key and /vibe/dev/tinyfish-api-key |
| Invitation sender | SSM String /vibe/dev/invite-sender, verified SES identity in Ohio, sandbox sending |
| Background discovery | Enabled rate(5 minutes), 120-second idle threshold, at most one party batch per 300 seconds |

Bhavesh's local AWS profile `vibe-team` is IAM user bhavesh; its VibeDeployers group currently has AdministratorAccess and SignInLocalDevelopmentAccess. On another machine use the developer's own authorized profile and verify STS account before AWS mutations. The earlier scoped policy example in docs/aws/ is not required while admin access is effective. Runtime roles independently use scoped permissions, including the Haiku profile and its verified US destination-model ARNs.

The existing **Monthly Budget $50** was confirmed; it notifies rather than enforcing a hard cap and includes other account workloads. Provider billing is separate. Actual costs have not been measured. Preserve existing provider values; no keys belong in Git or frontend configuration.

## Delivered follow-ups

- Background party-note additions no longer invalidate every running answer. Manual corrections/deletion, current membership/sharing, canonical versions and historical-answer guards remain enforced.
- Latest request is pinned separately from party goals/history. Retrieval begins with that request and short earlier human context, excluding assistant recaps. Named professor/course questions should remain focused on the requested assessment.
- ASU search supports keywords/instructor names without a catalog number, plus level/campus/delivery/session/days/dates/units/college/open/honors filters. Numeric ASU semester codes stay internal; names/year are normalized deterministically.
- Syllabi rank requested-term/same-professor evidence, six earlier terms for that professor, then labelled other-professor evidence, under a 60-second budget. Source-term links, page excerpts and historical/different-instructor/partial flags remain explicit.
- RMP general professor metrics and course-specific review samples are separate. Cursor pagination and bounded sample metrics are available; a missing course in the sample does not establish no reviews exist. Textual tool markup cannot be published as a finished recommendation. Duplicate warnings are removed.

## Final verification and limits

**56 backend tests and 10 adapter tests passed** before the teammate handoff. The subsequent Milestone 4 update passed **77 backend tests**. The 3B update passed **25 focused memory checks**, workspace typechecks, production build and strict CDK synthesis. A subsequent authorized two-user live Haiku scenario passed the checks recorded in the completion report. Diff/whitespace checks passed. The existing frontend bundle-size advisory remains. Planned source/docs were scanned for credential patterns; no provider keys, AWS access IDs or private-key blocks were found. Ignored secrets, generated wheels, CDK output and browser credentials are excluded. The unrelated `output/imagegen/vibe-devpost-thumbnail.png` is preserved locally and excluded from this handoff.

Earlier private-account multi-user/browser/source assertions passed, with cleanup recovery documented. The November 15 completion check used two temporary shared-account users and two @Vibe requests. It passed pronoun-free English and Spanish private learning, quote/third-party/one-trip exclusions, source ownership, equivalent-fact provenance consolidation, corrected owner previews, real TinyFish general research and sourced ASU class research. It produced two and three initial candidates for the respective users. The public frontend asset includes the new extraction-state UI. This check covers specific observed examples. Broad recommendation-quality evaluation and a new browser/mobile interaction pass remain outside its scope. The earlier stopped eight-call synthetic evaluation remains historical evidence only.

External source coverage is bounded and availability can change. The checked live syllabus probe earlier returned not_found; syllabus extraction/ranking has offline fixture coverage. Derived provider abstractions with unverifiable inputs are withheld. Broad semantic/language quality, physical-device and inbox-confirmation checks remain open. Conditional asynchronous TinyAgent browser research awaits an actual interaction need. Two older synthetic PARTY_NOTES dead-letter jobs in the retained private account were left untouched; no queue was purged.

Evidence:

- [Milestone 5 UI integration and README](docs/results/milestone-5-ui-integration-2026-11-15.md)

- [Milestone 4 completion and deployment](docs/results/milestone-4-completion-2026-11-15.md)

- [Milestone 3 completion and deployment](docs/results/milestone-3-completion-2026-11-15.md)

- [Latest tool coverage](docs/results/research-tool-parity-2026-11-15.md)
- [Current-question correction](docs/results/current-question-scope-2026-11-15.md)
- [Shared Haiku deployment](docs/results/haiku-team-deployment-2026-11-15.md)
- [Earlier integration/browser checkpoint](docs/results/milestone-3-integration-2026-11-15.md)
- [Original 3A live checkpoint](docs/results/milestone-3a-live-2026-11-14.md)

## Setup and future deployment

Use Node 24+, npm and Python 3.12/pip. `npm ci`; prepare a local `.venv` and install research/requirements.txt plus pytest; build the research asset with `npm run build:research`; run tests/typechecks and `npm run build`. See [research setup/provenance](research/README.md). The vendored clients are sufficient to build; the ignored SameClass reference checkout is optional.

The completion deployment used Anish’s local `default` profile, verified as account 851725603471. For shared deployment set your own AWS_PROFILE, AWS_REGION=us-east-2, VIBE_AWS_ACCOUNT=851725603471, VIBE_AWS_REGION=us-east-2 and VIBE_LOW_QUOTA=false. The existing `/vibe/dev/invite-sender` parameter is required by the SES identity-scoped deployment policy. In a new account, verify a sender in that region and create this String parameter before synthesis/deployment. Run strict `npm run synth`, review `npm run diff -w infra`, then deploy only within the current chat's authorization. Do not overwrite secrets or change account/region implicitly.

Local `web/.env.local` is ignored and currently targets this shared backend; another machine must copy `web/.env.example` and fill the public values above. Use the absolute API Gateway URL locally. Production loads `/config.json`. Local provider keys are not needed for frontend-only work.

## Retained private account and history

The private deployment at https://d2fyk3jb2bpp2q.cloudfront.net remains separate in account 782610231983, Ohio. Accounts/chats were not migrated. Its local profile is `vibe-dev`; it requires explicit private account/region settings and VIBE_LOW_QUOTA=true due to the ten-concurrent-Lambda quota. Its $10 initial allowance applies separately. Do not use that URL to evaluate shared Haiku changes.

[The archived pre-handoff status](docs/history/status-before-milestone-3-handoff.md) preserves the prior M1/M2/private deployment chronology, settings and original Anish handoff. Those historical pending/commit statements are superseded by this file and the current plan. Git history identifies the exact published handoff revision.
