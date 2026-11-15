# Previous project: Ray (SameClass, track 3)

Location: `sameclass-track3/` (nested repository with its own git history, ignored by this repository's `.gitignore`).

## What it was

Ray was a Discord bot that helped friends plan a semester together. Friends talked normally in a Discord channel; Ray did course research and produced group recommendations.

- `/ask` for course, syllabus and professor questions.
- `/plan start`, Join planning, natural discussion, then `/plan recommend` for individual and shared class recommendations.
- Opt-in voice in a Discord voice channel through ElevenLabs.
- A public scroll-story landing page with scripted example data.

## Stack

| Part | Technology |
| --- | --- |
| Bot | TypeScript, discord.js, LangGraph.js, Vercel AI SDK with OpenRouter |
| ASU catalog API | Python FastAPI: sections, schedules, prerequisites, syllabus extraction (unofficial) |
| Professor API | Python FastAPI over Rate My Professors GraphQL (unofficial) |
| State | Postgres (local Docker; Supabase planned) |
| Website | React, Vite, GSAP |

## Design lessons from Ray

- Respond on an actual mention, or on a direct reply to Ray's outstanding clarification. Do not call the model for every message.
- A channel's members are not automatically participants. Joining is explicit.
- Author-owned profiles: a participant changes only their own preferences. A quoted claim about someone else is neither consent nor preference.
- Keep identity separate from display names.
- Keep deterministic decisions (permissions, schedule conflicts, matching) in code, not in the model.
- Bound everything: messages in context, model calls, tool calls, timeouts.
- Link sources and flag missing or uncertain information.
- Keep a portable chat core behind a platform adapter.

## Reuse status

The user has authorized integrating the existing ASU course-search and Rate My Professors retrieval tools into Vibe's new web app. Their deployment is specified in `architecture.md`. Preserve source attribution and record the event organizer's interpretation of prior-service reuse for submission. The APIs are unofficial and unauthenticated, so Vibe's backend will mediate access and verify current source health.
