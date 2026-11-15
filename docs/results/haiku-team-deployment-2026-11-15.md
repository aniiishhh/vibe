# Haiku and shared-account deployment — November 15, 2026

Application: https://d1ia555vbcj8k2.cloudfront.net. Account 851725603471, us-east-2, stack Vibe-dev: UPDATE_COMPLETE. This supersedes the retained private-account URL for further development and manual Haiku evaluation.

## Deployed configuration

- Agent and memory Lambda configuration is Active / LastUpdateStatus Successful with `us.anthropic.claude-haiku-4-5-20251001-v1:0`. Cross-model fallback is disabled. Runtime IAM covers the exact inference profile and its three verified US destination foundation-model ARNs, conditioned on the profile.
- Anthropic first-use details were submitted using factual Vibe student-project information. The requested profile returned READY in a real invocation before deployment.
- New IAM-only `vibe-dev-research` Python Lambda supplies the approved SameClass retrieval clients, including real level/keyword course discovery. No stateful resources were replaced.
- TinyFish key is server-side SecureString `/vibe/dev/tinyfish-api-key`; the existing Supermemory parameter was preserved. Values were not logged or committed.
- Profile `vibe-team` is IAM user bhavesh; VibeDeployers has AdministratorAccess and SignInLocalDevelopmentAccess. The earlier minimal policy example is not required while admin access is effective. Existing Monthly Budget $50 was confirmed; actual spending was not measured.
- The website and config endpoint return HTTP 200, and public configuration identifies the shared Cognito pool `us-east-2_zrHcAFg7r`. Ignored local frontend settings now target this backend.

## Behavior changes and evidence

The update includes the prior milestone 3 memory corrections/profiles/research and natural semester conversion, now using Haiku for agent and extraction work. Open-ended recommendations have a bounded real-offering discovery tool, grouping duplicate sections by course and enforcing the requested numeric level. Topic searches with the corrected ASU graduate filter returned real CSE 510, EEE 523 and EEE 524 offerings in the bounded source probes. Recommendations are prompted to use retrieved offerings and preserve unknown schedules/eligibility. Textual function-call/XML output is rejected as an invalid finished answer and is never executed from prose.

Local checks passed 53 backend tests, three Python adapter tests, workspace typechecks, production build, strict synthesis and diff review. The existing frontend bundle-size advisory remains. Anish's latest 3e25592 contains planning-only changes; its expanded milestone 4 plan was preserved locally. No commit/push was performed.

An extra synthetic native-tool/source evaluation hit its eight-call budget without producing a final answer. The user explicitly declined further testing and chose to manually evaluate the deployed application. No Haiku recommendation-quality acceptance or live shared-app scenario pass is claimed. Deployment/configuration checks are distinct from behavior testing.

## Manual handoff

Hard-refresh the shared URL, use an account on that deployment, and start a fresh party with Spring 2027 and 500-level courses in the goal. Share each person's interests/time constraints and ask Vibe to summarize and recommend sourced offerings. Inspect the source links and unknown schedule/eligibility statements. Existing private-deployment accounts/chats were not transferred; that deployment remains separate and unchanged.

Use the explicit team account/profile/region flags in STATUS.md for future deployment. Broader automatic personal learning (3B), milestone 4 and the documented retrieval/real-device limits remain pending.
