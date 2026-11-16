// Generates the voiceover per scene with ElevenLabs TTS + character timestamps.
// Reads ELEVENLABS_API_KEY from the environment (source the repo's .env first). Never prints it.
// Usage: node voice.mjs [sceneId ...]   (no args = all scenes; existing files are kept)
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';

const key = process.env.ELEVENLABS_API_KEY;
if (!key) throw new Error('ELEVENLABS_API_KEY is not set. Run: set -a; source ../../.env; set +a');
const script = JSON.parse(await readFile(new URL('./script.json', import.meta.url)));
const out = new URL('../film/assets/voice/', import.meta.url);
await mkdir(out, { recursive: true });
const only = process.argv.slice(2);

for (const [index, scene] of script.scenes.entries()) {
  if (only.length && !only.includes(scene.id)) continue;
  const mp3 = new URL(`${scene.id}.mp3`, out);
  if (!only.length) { try { await access(mp3); console.log(`skip ${scene.id}`); continue; } catch { /* generate */ } }
  const body = {
    text: scene.text,
    model_id: script.model,
    voice_settings: { stability: 0.45, similarity_boost: 0.8 },
    previous_text: script.scenes[index - 1]?.text,
    next_text: script.scenes[index + 1]?.text,
    apply_text_normalization: 'on',
  };
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${script.voiceId}/with-timestamps?output_format=mp3_44100_192`, {
    method: 'POST', headers: { 'xi-api-key': key, 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!response.ok) { console.error(scene.id, response.status, (await response.text()).slice(0, 300)); process.exitCode = 1; continue; }
  const result = await response.json();
  await writeFile(mp3, Buffer.from(result.audio_base64, 'base64'));
  // Collapse character timings into word timings for cueing visuals.
  const { characters, character_start_times_seconds: starts, character_end_times_seconds: ends } = result.normalized_alignment ?? result.alignment;
  const words = [];
  let current = null;
  characters.forEach((char, i) => {
    if (/\s/.test(char)) { if (current) words.push(current); current = null; return; }
    if (!current) current = { word: '', start: starts[i], end: ends[i] };
    current.word += char;
    current.end = ends[i];
  });
  if (current) words.push(current);
  await writeFile(new URL(`${scene.id}.words.json`, out), JSON.stringify({ duration: ends.at(-1), words }, null, 1));
  console.log(`${scene.id}: ${ends.at(-1).toFixed(2)}s, ${words.length} words`);
}
