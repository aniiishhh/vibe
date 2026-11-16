# SPEC: Vibe demo film

GOAL: A judge finishes knowing that Vibe is a group chat whose AI teammate researches for the group and remembers people only with consent. They also see the AWS design and Pip.

OUTPUT: HyperFrames, 1920×1080, 30 fps. TIME: 116.5 s × 30 = 3495 frames. Narrated, so the voice is the clock (`assets/voice/*.words.json`).

LOOK
- Medium: Vibe's own product UI. Real screen recordings from `demo-video/ui` run on demo data at 3200×1800 (2× scale) and are shown at 1920×1080. Punch-ins go up to 2.1×, so text stays at 26 px or larger.
- Ground: the product's own surfaces, white `#ffffff` and sidebar `#f6f6f8`. The palette never uses a dark void, except for the memory page, which is the app's real dark mode.
- Ink: `#1f1b27`. Accent: coral `#ec5a44`, used only on highlights, callout bars, the travelling dot and the end-card URL.
- Type: Geist 600/700 for callouts (38 px) and end-card lines (56–64 px). The lockup wordmark is Geist 700 at 180 px. Patrick Hand appears only inside Pip's speech balloons, as in the app.
- Depth: callout cards use a shadow at 0 12 px 30 px, rgba(31,27,39,.18). There is no grain and no vignette.

OBJECTS
- The real chat, details panel, invite dialog and memory page.
- Pip, the real SVG component recorded live, plus transparent PNG poses exported from the same component.
- The user-supplied AWS diagram PNG.
- A graphic of Supermemory spaces, drawn with the app's cards and colours.

MOTION
- Camera: 0.45–0.6 s on `power3.inOut`. Punch-in cuts are hard cuts within a scene. It holds while the UI acts.
- Arrivals: `expo.out` over 0.5 s. Exits are 40% shorter.
- Callouts: blur 8→0 px with opacity over 0.18 s; out over 0.14 s.
- Pip PNG flights: arcs on `power2.inOut` with `back.out(1.6)` on landing (playful, damping about 0.5).

SHOTS (absolute seconds)
| Shot | Time | Content | Hand-off |
| --- | --- | --- | --- |
| 1 | 0–6.4 | Four friends post in the class chat. The camera pushes to Maya's vegetarian line, then pulls back. | Whip left |
| 2 | 6.4–14.4 | Starter card → dialog → "Choosing theme…" → Studies party, push to Pip's cap. | Cut |
| 3 | 14.4–31.0 | Four @Vibe answers (catalog, syllabus, RMP, schedules), each with a callout, then Sources opens. | Cut |
| 4 | 31.0–39.4 | Notes, Accept assignment, invite QR code. | Green flood from the sidebar |
| 5 | 39.4–48.6 | Weather table, itinerary, Pip presents, marker on "Maya's vegetarian". | Frame shrinks into the diagram's laptop |
| 6 | 48.6–74.2 | AWS diagram. A coral dot follows the message through steps 1–5. Pip flies to Supermemory. | Zoom through the Supermemory box |
| 7 | 74.2–93.6 | The source message, the candidate on the memory page, the spaces graphic, approve, switch on, edit/delete. | Iris |
| 8 | 93.2–109.4 | Pip: juggle, peek, love, present, drag and dizzy, nap and poke, then seven outfits. | White flood |
| 9 | 109.4–116.5 | Pip carries in the mark, then the lockup, tagline, URL and credits. | End |

SOUND
- Voice: Jessica (ElevenLabs `eleven_v4`), normalized to −16 LUFS.
- Music: an ElevenLabs `music_v2_5` bed at volume 0.15. It enters at 6.4 s on the reveal and fades over the last 2 s.
- Effects: one cause on screen each (pops, clicks, whooshes, confetti, boing, squeak, snore, riser into the mark).

BANNED: dark void, glow/particles, three cards in a row, a title over a dimmed screenshot, a docked logo, everything fading up, titles that move while being read, invented UI presented as the product.

QA frames: 1.0, 5.0, 8.5, 18.5, 21.0, 27.5, 33.5, 36.5, 47.5, 50, 56, 62, 72.5, 75, 81, 86, 90, 95, 101, 104, 107.5, 112, 115.5.
