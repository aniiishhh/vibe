# Vibe

Product direction agreed in conversation on November 14, 2026. Technical choices and proposed delivery scope are in `architecture.md` and `implementation-plan.md`.

## Core idea

Vibe is a web app where friends, classmates, and teammates discuss a shared goal with an AI participant. People create persistent group workspaces called parties, invite others, talk naturally, and mention @Vibe for explanations, research, suggestions, and shared plans.

Vibe supports general-purpose collaboration. Students and hackathon teams are the first audience. Taking classes together, studying, brainstorming a hackathon project, and planning a trip are supported uses of the same party experience.

## Parties and conversation

- Create a party with a name and goal.
- Invite people through a shareable link or QR code. Email invitations are part of the product direction.
- Join explicitly, retain a stable identity, and revisit conversation history.
- Discuss freely with other people and tag @Vibe when help is wanted.
- Reply directly to a clarification addressed to you to continue that exchange.
- See who contributed each message, which sources support an answer, and whether Vibe is working, researching, or encountering a problem.
- Review a shared plan and tasks alongside the conversation.

A party belongs to the application and persists across visits. People can belong to several parties using the same account.

## What @Vibe helps with

Vibe answers questions, explains concepts, brainstorms, researches the web, compares options against participants' stated preferences, and creates persistent plans through application tools.

For students choosing classes, it can search ASU offerings, inspect course details and syllabi, retrieve Rate My Professors evidence, and identify classes participants can attend together. Schedule checks use structured meeting information and explicit constraints. Recommendations show shared options, individual alternatives, sources, and missing information.

The existing course-search and professor-review tools in `sameclass-track3/` will supply those research capabilities, as authorized by the user. Vibe provides the new web interface, identity, party state, memory controls, and agent integration.

## Personal memory across conversations

Each person has a compact, editable memory profile that can become more useful over time.

- Add, edit, and delete profile points manually.
- Enable automatic memory accumulation from your own contributions across parties.
- Review what Vibe learned and the messages supporting it.
- Choose which facts are approved for reuse.
- Control whether your shared preferences are used in each party.
- Correct an outdated fact and have the correction govern subsequent answers immediately.

Examples include vegetarian food preferences, subject interests, preferred class times, travel preferences, and preferred explanation style. Temporary availability and project deadlines retain their time and party context.

Automatic learning and sharing are distinct controls. Turning on learning allows Vibe to accumulate personal facts for review. Cross-party reuse uses facts the owner has approved. Statements about another person remain attributed to their speaker and cannot silently become that person's profile.

## Party memory and privacy

Each party retains its goal, discussion, decisions, constraints, and unresolved questions. Its members can ask Vibe to recall earlier discussion.

Membership in another party, even with the same people, does not grant access to the first party's history. A reusable personal preference can travel with its owner's approval. The original party name, message link, and private surrounding discussion remain subject to the original party's access rules.

Supermemory supplies persistent memory processing and retrieval. Application records preserve ownership, permission, provenance, correction versions, and deletion state.

## Compact memory

The memory experience takes inspiration from Hermes's bounded user and agent notes. Vibe presents concise personal and party summaries, consolidates repeated information, replaces superseded facts, and expires temporary constraints. Relevant older evidence can be retrieved when needed.

Users can view their profile as readable points and export it as Markdown. The technical design uses structured records and managed memory documents to support simultaneous users and individual corrections.

## Conversational modes

| Mode | Behavior |
| --- | --- |
| Focused | Concise, organized, and task-oriented |
| Friendly | Warm explanations with occasional humor and emoji |
| Banter | Opt-in playful reactions and light jokes |

Modes affect tone. Attribution, permissions, research standards, memory sharing, and action approval apply in every mode. Useful proactive contributions can be considered after mention-based interaction works reliably.

## Shared action

Vibe can propose tasks with a title, details, suggested assignee, and optional due date. A person explicitly accepts an assignment and marks their work complete. Material changes to an accepted assignment require renewed acceptance. The interface distinguishes proposals from commitments.

## First release

The proposed first release includes accounts, parties, link and QR invitations, persistent multiuser chat, @Vibe responses, manual and automatic memory, sharing controls, cited research, course/professor tools, and one shared task workflow. Focused, Friendly, and Banter are lightweight tone settings.

The implementation plan stages these capabilities so a working multiuser chat and AI response can be demonstrated first. Email delivery and interactive browser research have explicit integration prerequisites in the architecture.

## Demonstration

1. Real participants join a class-planning party on their devices.
2. They discuss interests and constraints and ask @Vibe to research classes and professors.
3. Vibe explains shared options with evidence and creates proposed next steps.
4. A participant reviews an automatically learned preference and approves reuse.
5. A trip-planning party uses an appropriate shared preference with that person's per-party opt-in.
6. A correction changes the next answer while unrelated party discussion remains inaccessible.

The demo uses real research and persisted actions. Measurements cover latency, attribution, corrections, access isolation, and successful actions.
