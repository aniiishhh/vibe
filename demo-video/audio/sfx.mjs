// Generates the film's sound effects and music bed with ElevenLabs. Skips files that exist.
// Usage: set -a; source ../../.env; set +a; node sfx.mjs
import { writeFile, mkdir, access } from 'node:fs/promises';

const key = process.env.ELEVENLABS_API_KEY;
if (!key) throw new Error('ELEVENLABS_API_KEY is not set');
const out = new URL('../film/assets/sfx/', import.meta.url);
await mkdir(out, { recursive: true });
const exists = async (url) => access(url).then(() => true, () => false);

const effects = [
  ['pop-1', 'Soft, rounded UI pop, like a chat message bubble appearing. Clean, short, no reverb.', 0.5],
  ['pop-2', 'Clean bubbly pop sound, like a soap bubble popping, crisp and audible, short.', 0.6],
  ['whoosh-1', 'Quick airy whoosh transition, smooth, modern UI swipe.', 0.8],
  ['whoosh-2', 'Short soft swish transition, light wind, clean.', 0.7],
  ['whoosh-3', 'Fast whip pan whoosh, bright and short.', 0.6],
  ['click', 'Crisp soft mouse click, single, close-miked.', 0.5],
  ['keys', 'Soft laptop keyboard typing, quick light keystrokes, about two seconds, quiet room.', 2.2],
  ['confetti', 'Cheerful tiny party popper burst with sparkly confetti shimmer, cartoon, short.', 1.2],
  ['boing', 'Cartoon rubbery boing bounce, playful, short.', 0.8],
  ['squeak', 'Tiny cute cartoon squeak, like a toy being poked, very short.', 0.5],
  ['snore', 'Small cute cartoon character snoring softly, two gentle snores.', 2.5],
  ['sparkle', 'Magical twinkle sparkle shimmer, short and light.', 1.0],
  ['riser', 'Short bright riser building up into a satisfying soft impact hit, upbeat logo reveal.', 2.5],
];

for (const [id, text, seconds] of effects) {
  const file = new URL(`${id}.mp3`, out);
  if (await exists(file)) { console.log(`skip ${id}`); continue; }
  const response = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
    method: 'POST', headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: 'eleven_text_to_sound_v3', duration_seconds: seconds, prompt_influence: 0.6 }),
  });
  if (!response.ok) { console.error(id, response.status, (await response.text()).slice(0, 300)); continue; }
  await writeFile(file, Buffer.from(await response.arrayBuffer()));
  console.log(`sfx ${id}`);
}

const music = new URL('../music/bed.mp3', out);
await mkdir(new URL('../music/', out), { recursive: true });
if (!(await exists(music))) {
  const plan = {
    chunks: [
      { text: '[Intro]', duration_ms: 12000, positive_styles: ['bright indie pop', 'instrumental', 'plucky electric guitar', 'warm synth pads', 'light claps', 'upbeat', '112 bpm'], negative_styles: ['vocals', 'dark', 'aggressive', 'heavy bass'], context_adherence: 'high' },
      { text: '[Verse] playful and curious', duration_ms: 34000, positive_styles: ['light drums', 'marimba accents', 'friendly'], negative_styles: ['vocals'], context_adherence: 'high' },
      { text: '[Breakdown] calmer, focused, fewer instruments', duration_ms: 40000, positive_styles: ['soft pulse', 'muted guitar', 'ambient pads', 'minimal'], negative_styles: ['vocals', 'loud drums'], context_adherence: 'high' },
      { text: '[Chorus] full and joyful', duration_ms: 24000, positive_styles: ['full band', 'bright', 'bouncy', 'claps'], negative_styles: ['vocals'], context_adherence: 'high' },
      { text: '[Outro] resolve and end', duration_ms: 10000, positive_styles: ['warm ending', 'final chord'], negative_styles: ['vocals', 'abrupt'], context_adherence: 'high' },
    ],
  };
  const response = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_192', {
    method: 'POST', headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ composition_plan: plan, model_id: 'music_v2_5' }),
  });
  if (!response.ok) console.error('music', response.status, (await response.text()).slice(0, 500));
  else { await writeFile(music, Buffer.from(await response.arrayBuffer())); console.log('music bed'); }
}
