# Vibe demo video plan

Status: first cut rendered Nov 15, 2026 at `demo-video/film/renders/vibe-demo.mp4` (1:56.5). Review notes are in `demo-video/film/REVIEW.md`, and rebuild steps are in `demo-video/README.md`. In the build, the class party uses the real starter name "Classes next semester".

## Goal

A 1:50 to 2:00 video (1920×1080, 30 fps) for SunHacks 2026 judges. It covers Vibe's core features and makes the case for four tracks: Best use of AWS, Best use of Supermemory, Best mascot and Best overall. It uses an ElevenLabs voiceover, sound effects and music, and is built with HyperFrames. The credits name the team: **Anish and Bhavesh**.

The one thing a viewer should remember: **Vibe is a group chat with an AI teammate that researches for the group and remembers people only with their consent.**

Tone: a friendly product demo first, with a short technical layer in the AWS and Supermemory scenes.

## What the video shows (verified against the code)

| Feature | Real UI used | Source |
| --- | --- | --- |
| Parties with a goal, four starters, Haiku-chosen theme ("Choosing theme…") | `WorkspaceHome`, `CreatePartyDialog` | `web/src/App.tsx:344-460`, `backend/src/party-theme.ts` |
| Seven themes, each with a tiled backdrop and a matching Pip outfit | `PartyBackdrop`, `ThemeProp`, `HeldItem` | `web/src/backdrops.tsx`, `web/src/mascot.tsx` |
| @Vibe mentions, thinking pill with themed words, sourced replies, research warnings | `ChatPanel`, `ThinkingRow`, `MessageRow` | `App.tsx:1250-1700` |
| ASU class search, course discovery, syllabus evidence, Rate My Professors, group schedule comparison, TinyFish web search and fetch, task proposals | agent tools | `backend/src/research.ts` |
| Party notes, tasks that need acceptance, Focused/Friendly/Banter modes | `PartyDetailsPanel`, `PartyTasks` | `App.tsx:872-1107`, `PartyTasks.tsx` |
| Invites by link, QR code and SES email | `InviteDialog` | `App.tsx:1162-1248` |
| Personal memory: candidates, approval, the per-party "Use my approved memory" switch | `MemoryPage`, `MemorySharingControl` | `MemoryPage.tsx`, `App.tsx:996-1040` |
| Pip: 22 states, 10 idle actions, drag, poke, peek at the caret, flying to present a reply | `MascotDock`, `Mascot` | `mascot-dock.tsx`, `mascot.tsx` |
| AWS architecture | `docs/assets/aws-architecture.png` | `infra/lib/vibe-stack.ts` |

## Scenarios

All people are fictional students: **Maya** (the viewer, admin), **Jordan**, **Priya** and **Leo**. Every scene uses demo data, and the end card says so in small type.

### Scenario A: "CSE classes, Spring '27" (Studies theme)

- **Party:** "CSE classes, Spring '27", goal "Find a CSE class all four of us can take together". Pip wears the mortarboard and glasses and holds a book.
- **Opening chatter:** Leo asks "ok which 500-level CSE class are we doing??". Maya says "anything but 8ams pls 😭 also I'm vegetarian so no dining hall study sessions lol". This line is what Supermemory learns later. Jordan and Priya join in.
- **Four @Vibe questions, each using a different source:**

| Who | Question | Tool and source | Reply shape |
| --- | --- | --- | --- |
| Jordan | "@Vibe what CSE 500-level classes are open for spring?" | `discover_courses` / `search_classes` on the ASU class catalog (`catalog.apps.asu.edu`, term 2271) | Table with course, title, days and time, and open seats; 3 catalog citations |
| Priya | "@Vibe how heavy is CSE 511? any final project?" | `get_syllabus_evidence` from the course syllabus | Grading split, a team project and weekly assignments; syllabus citation |
| Leo | "@Vibe what do students say about the profs?" | `get_professor_reviews` on Rate My Professors | Fictional instructors with ratings and a quoted theme each; the real warning "Professor reviews are a limited sample, not complete coverage." |
| Maya | "@Vibe which section works for all 4 of us? no 8ams" | `compare_group_schedules` plus `propose_task` | Recommends the Tue/Thu 10:30 section, explains who it works for, and proposes the task "Register for CSE 511 (Tue/Thu 10:30)" |

- **Follow-up:** the decision becomes a party note, Jordan accepts the task, and the invite dialog appears.

### Scenario B: "Saturday day trip" (Outdoors theme)

- **Party:** "Saturday day trip", goal "Pick a day trip from Tempe everyone's up for". Pip wears the explorer hat and holds a trail flag.
- **Chatter:** Priya: "Sedona or Flagstaff??". Leo: "isn't it gonna be too hot to hike".
- **Questions:**
  - Jordan: "@Vibe what's the weather Saturday in Sedona vs Flagstaff?" → `web_search` / `web_fetch` (TinyFish) with weather.gov and nws citations. The reply is a two-row comparison (Sedona sunny, upper 70s; Flagstaff cooler, low 60s with a late-afternoon shower chance), and Vibe recommends Sedona.
  - Priya: "@Vibe plan our day, we leave Tempe at 9" → an itinerary: Cathedral Rock trail in the morning, lunch in Uptown Sedona with a note that "Maya's vegetarian, so these spots have good veggie options", Slide Rock State Park in the afternoon, and home by sunset. It also proposes the task "Bring 3L water each".
- The vegetarian line is the payoff that Scenario A set up, and the Supermemory scene explains how Vibe knew.
- Weather values and restaurants are illustrative. No named restaurant gets a made-up claim.

## How the footage is made

- **`demo-video/ui`:** a copy of `web/` plus `shared/src`. Nothing outside `demo-video/` changes.
  - Vite aliases `@vibe/shared` to the copied types. It also points `aws-amplify` (auth, Events, Hub) to local stubs: a fixed signed-in Maya, a fake token, and an Events channel that the director can trigger.
  - A mock `fetch` serves every `/api/...` route from an in-memory store, so `api.ts` and `App.tsx` stay unchanged except where noted below.
  - The scene director (`window.__director`) adds other members' messages and moves @Vibe runs from queued to thinking to completed with scripted replies. That drives the real thinking pill and Pip's done → present → reading sequence. `Math.random` is seeded so Pip's lines repeat on every take.
  - Clone-only tweak: Pip's sleep timer is shortened from 45 s to 6 s so the nap fits in a take.
  - A `pip.html` page renders the real `Mascot` in every outfit for the close-ups.
- **`demo-video/capture`:** Playwright Chromium (already cached locally) records each scene at 1600×900 with a 2× device scale. Playwright types into the real composer and drags Pip with the real mouse.
- **`demo-video/audio`:** ElevenLabs scripts for the voice (with timestamps), sound effects and music.
- **`demo-video/film`:** the HyperFrames project. It has one composition per scene, captured clips as muted `<video>` elements, and camera moves on wrapper elements. The real architecture PNG has highlights drawn over it. `check`, `snapshot --review` and `REVIEW.md` run before the render.

## Sequence

Timings are targets, and the voice timestamps set the final cut. The voiceover is about 310 words.

| # | Time | Scene | On screen | Voiceover (draft) |
| --- | --- | --- | --- | --- |
| 1 | 0:00–0:06 | **Hook** | The class chat fills fast with four people talking over each other. Pip's eyes dart between the messages. | "Four friends, one group chat, and a plan buried somewhere under all the messages." |
| 2 | 0:06–0:12 | **Start a party** | Click the "Classes next semester" starter. The button reads "Choosing theme…", the Studies backdrop tiles in and Pip's cap pops on. | "Vibe is a group chat with an AI teammate built in. Give your party a goal, and Vibe picks a theme to match." |
| 3 | 0:12–0:38 | **Class search** | The four @Vibe questions. Q1 plays at full speed: Pip peeks at the caret, says "You rang?", the thinking pill shows, the table lands, and the camera punches in on Sources. Q2 and Q3 are punch-ins on the syllabus reply and on the RMP reply with its warning. Q4: the section pick and the task proposal, and Pip flies over to present it. | "Tag @Vibe and it does the research. It checks ASU's live class catalog, reads the syllabus, samples Rate My Professors, and compares everyone's schedules to find the one section that works for all four. Every answer shows its sources." |
| 4 | 0:38–0:46 | **Teamwork** | The details panel slides in, showing the decision note, Jordan clicking Accept assignment, and the mode switch. Then the invite QR code. | "Decisions become notes, tasks count once someone accepts them, and inviting friends takes a link or a QR code." |
| 5 | 0:46–1:02 | **Day trip** | A whip to the Outdoors party, with Pip in the explorer hat. The weather comparison lands. The itinerary lands with the vegetarian line highlighted. | "It isn't only for classes. Planning a Saturday in Sedona? Vibe checks the weather, builds the day, and remembers Maya is vegetarian." |
| 6 | 1:02–1:20 | **AWS** | The real diagram. A coral dot carries Jordan's weather question through steps 1→5 as each area lights up. | "Here's how. CloudFront and S3 serve the app, and Cognito signs you in. API Gateway and Lambda save every message to DynamoDB. A stream dispatcher queues AI work in SQS FIFO, where Lambda workers call Claude Haiku 4.5 on Bedrock and our research tools. AppSync Events streams the answer back live, and EventBridge sweeps up anything that slipped." |
| 7 | 1:20–1:38 | **Supermemory** | Zoom into the diagram's Supermemory box. The hook message "I'm vegetarian lol" reappears, then the memory page (dark mode) with the pending candidate. Maya approves it, then turns on "Use my approved memory" in the trip party. | "So how did Vibe know? Supermemory learned it from the class chat, without anyone tagging Vibe. It keeps every party, private note and approved fact in its own space, and nothing crosses over until you approve it and switch it on for that party. Edit or delete it any time." |
| 8 | 1:38–1:53 | **Pip** | A push-in on Pip doing a run of real reactions: wave, peeking over the composer, laughing at "lol", hearts at "thank you", a tear at "ugh exams", dragged and swinging, dizzy, asleep, poked awake, juggling. Then all seven outfits. | "And this is Pip. Pip peeks over your message while you type, reacts to the mood of the chat, delivers Vibe's answers in person, gets dizzy when you drag it, and naps when things go quiet. Every theme comes with its own outfit." |
| 9 | 1:53–2:00 | **End card** | Pip carries in the Vibe mark, followed by "vibe-chat.us". Credit line: "Built by Anish and Bhavesh · SunHacks 2026". In small type: "Demo conversations simulated." | "Vibe. Your group's AI teammate. Try it at vibe-chat.us." |

## Audio

- **Voice:** ElevenLabs `eleven_v4`. A friendly premade voice is chosen from the account's premade list, and each scene is generated with timestamps.
- **Music:** ElevenLabs Music `music_v2_5`, instrumental. Bright, light indie-pop around 110 bpm, 2 minutes, with a quieter middle for AWS and Supermemory and a lift for Pip. It sits about −18 dB under the voice.
- **Effects:** key ticks, message pops, cut whooshes (three takes), the confetti burst, the boing when Pip is dropped, a squeak on the poke, a snore, and one riser into the end card. Each one has a cause on screen.
- **Levels:** about −14 LUFS and −1 dBTP, measured after the render.

## Track coverage

| Track | Where | What a judge takes away |
| --- | --- | --- |
| Best use of AWS | Scene 6, plus the live updates and theme choice in scenes 2–5 | An event-driven, queued, least-privilege design on 15+ managed services, with Haiku 4.5 on Bedrock doing the agent, memory and theme work |
| Best use of Supermemory | Scene 7, set up by scenes 1 and 5 | It learns without being tagged, keeps separate spaces per party and person, asks before sharing, and lets people edit what it knows |
| Best mascot | Scenes 1, 3, 5 and 8 | Pip is part of how the product works (peeking, presenting, reacting to mood), with 22 states and 7 outfits |
| Best overall | The whole film | A real problem, a complete product, a live URL |
