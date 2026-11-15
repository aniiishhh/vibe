# Project guidance for Codex

- Read `docs/product-idea.md`, `docs/architecture.md`, `docs/technical-research.md`, and `docs/implementation-plan.md` for Vibe's current direction. Read `docs/hackathon.md` and `docs/previous-project.md` for event and source context.
- The user authorized integrating existing course-search and Rate My Professors retrieval tools from `sameclass-track3/` into Vibe's new web app. Preserve source attribution and mediate access through the backend.
- Scope and architecture are under review. Begin application implementation after user approval. Deployment needs the selected account, region and spending allowance. Ask before installing additional global tools.
- Project skills are in `.agents/skills/`. Use a relevant skill when its subject matches the task. The AWS and Supermemory MCP servers are configured in `.codex/config.toml` for this project.
- Keep secrets out of the repository. Ask before deploying or submitting to Devpost if the current chat has not already authorized it.
