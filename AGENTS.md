# Project guidance for Codex

- Read `STATUS.md` first for the current deployment, setup and handoff, then read `docs/product-idea.md`, `docs/architecture.md`, `docs/technical-research.md`, and `docs/implementation-plan.md` for Vibe's current direction. Read `docs/hackathon.md` and `docs/previous-project.md` for event and source context.
- The user authorized integrating existing course-search and Rate My Professors retrieval tools from `sameclass-track3/` into Vibe's new web app. Preserve source attribution and mediate access through the backend.
- The user approved Milestones 1 and 2 implementation on branch `anish/implementation`. Follow the documented scope and architecture. Deployment uses the selected account 851725603471, region us-east-2 and existing $50 monthly budget, and was authorized for Milestones 1 and 2 on November 14, 2026. Ask before installing additional global tools.
- Project skills are in `.agents/skills/`. Use a relevant skill when its subject matches the task. The AWS and Supermemory MCP servers are configured in `.codex/config.toml` for this project.
- Keep secrets out of the repository. Ask before deploying or submitting to Devpost if the current chat has not already authorized it.

- Maintain `STATUS.md` throughout implementation. Update it after every milestone completion, AWS deployment/change, material verification result and teammate handoff. Record actual deployed stack status, account/region, endpoints, resources, checks, gaps, next work and instructions to reproduce setup/deployment on another device. Keep `docs/implementation-plan.md` synchronized and never include secrets.
