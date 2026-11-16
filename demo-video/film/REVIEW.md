# Review: vibe-demo.mp4 (1:56.5, 1920×1080, 30 fps)

## Creative calls
- I built the "One semester, one chat" storyline. The other two are in `STORYLINES.md`.
- The class scene shows four questions from four people, each answered from a different source: the ASU class catalog, the syllabus, Rate My Professors and the group's schedules. The day trip shows a weather check and an itinerary that uses Maya's approved memory.
- The order is features → AWS → Supermemory → Pip → end card. The AWS scene ends by zooming through the diagram's Supermemory box into the Supermemory scene.
- Narration is ElevenLabs Jessica (`eleven_v4`). The music is ElevenLabs `music_v2_5`. There are 13 ElevenLabs sound effects, placed at 57 cue points.

## Measured
- `hyperframes check` passes. Remaining warnings: nested media starts (intentional, local times), dense callout track, sub-0.05 s audio slot rounding, and one contrast hit on the decorative coral icon.
- Rendered file: integrated −14.0 LUFS, LRA 2.5 LU, peak −1.0 dBFS. These were measured but not listened to.
- Frames from the render were checked at 24 points across all nine scenes.

## Not checked
- Nobody has heard the mix. Watch for music level under the voice in the AWS stretch and the timing of each effect against its picture.
- The demo data is illustrative: professor names, ratings, seats, the forecast and some citation URLs. The end card says "Demo conversations use sample data."

## Weakest shot and next steps
- The Supermemory spaces graphic (81–85 s) is the one drawn shot. Its layout is sparse. With more time I would animate the token's second hop (private → approved → trip) in sync with "until Maya approves it".
- The AWS close-ups upscale a 1568 px PNG by up to 1.85×, so they are slightly soft. A higher-resolution export of the diagram would sharpen them.

## Warnings kept on purpose
- `nested_media_start_basis_ambiguous`: every segment's `data-start` is local to its scene by design.
- `container_overflow` / `escaped_container`: camera wrappers are scaled past the frame on purpose for punch-ins.
