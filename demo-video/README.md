# Vibe demo video

This folder holds everything used to make the hackathon demo video. Nothing outside `demo-video/` was changed. The plan is in `docs/demo-video-plan.md`.

| Folder | What it is |
| --- | --- |
| `ui/` | Copy of `web/` plus `shared/src`, running on scripted demo data. A mock `fetch` (`src/demo/mock-server.ts`) answers every `/api` route, and `aws-amplify` is replaced by stubs (`src/demo/amplify-stub.ts`). |
| `capture/` | Playwright scripts that record each scene from the clone at 3200×1800 using Chrome's screencast. |
| `audio/` | ElevenLabs scripts for the voiceover, sound effects and music, plus `normalize.sh`. |
| `film/` | The HyperFrames project. `build.mjs` writes `index.html` and `compositions/*.html`. The output is `renders/vibe-demo.mp4`. |

## Differences from the real app (demo clone only)

- Demo data replaces the backend. All people, ratings, seats and forecasts are illustrative.
- `?sleepMs=` shortens Pip's 45 s nap timer so a nap fits in one take.
- Invite links show `https://vibe-chat.us` instead of the local capture server.
- `pip.html` renders the real `Mascot` component for close-ups and for the transparent pose PNGs.

## Rebuild

```sh
# 1. Clone UI (deps resolve from the repo's root node_modules)
cd demo-video/ui && ../../node_modules/.bin/vite          # http://127.0.0.1:5199

# 2. Record (in another terminal)
cd demo-video/capture && npm install --no-workspaces
node scenes.mjs hook start class trip memory pip solo outfits && node poses.mjs

# 3. Audio (key read from the repo .env, never printed)
cd demo-video/audio && set -a && source ../../.env && set +a
node voice.mjs && node sfx.mjs && ./normalize.sh

# 4. Film
cd demo-video/film && node build.mjs && npx hyperframes@0.9.53 check
npx hyperframes@0.9.53 preview        # the HyperFrames desktop app / Studio preview
npx hyperframes@0.9.53 render --quality delivery --video-frame-format png -o renders/vibe-demo.mp4
```

After re-recording a clip, check the cut points in `film/build.mjs` against the `*.marks.json` file next to each clip. Each mark records when an action happened, in seconds from page open.
