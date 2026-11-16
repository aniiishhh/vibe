// Shared helpers for recording scenes from the demo UI clone with Playwright.
import { chromium } from 'playwright';
import { mkdir, rename, rm } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

export const BASE = 'http://127.0.0.1:5199';
export const VIEW = { width: 1600, height: 900 };
export const SCALE = 2;
const OUT = new URL('../film/assets/clips/', import.meta.url).pathname;
const RAW = new URL('./raw/', import.meta.url).pathname;

/**
 * Opens a recording browser. `storage` seeds localStorage (theme, Pip position) before the app boots.
 * Returns { page, finish(name) } where finish saves an H.264 MP4 into film/assets/clips.
 */
export async function open({ path, storage = {}, record = true, dark = false }) {
  await mkdir(OUT, { recursive: true });
  await mkdir(RAW, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEW,
    deviceScaleFactor: SCALE,
    colorScheme: dark ? 'dark' : 'light',
    reducedMotion: 'no-preference',
  });
  await context.addInitScript((values) => {
    if (sessionStorage.getItem('demo-seeded')) return;
    sessionStorage.setItem('demo-seeded', '1');
    localStorage.clear();
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
  }, { 'vibe.theme': dark ? 'dark' : 'light', ...storage });
  // Playwright's video has no pointer, so draw one that follows the real mouse and dips on click.
  await context.addInitScript(() => {
    const install = () => {
      const cursor = document.createElement('div');
      cursor.id = 'demo-cursor';
      cursor.innerHTML = '<svg width="34" height="34" viewBox="0 0 24 24"><path d="M4 2.5 19.5 12l-7 1.6-3.6 6.4L4 2.5Z" fill="#1f1b27" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
      Object.assign(cursor.style, { position: 'fixed', left: '0', top: '0', zIndex: '2147483647', pointerEvents: 'none', transform: 'translate(-100px,-100px)', transition: 'scale 120ms ease-out', filter: 'drop-shadow(0 3px 4px rgba(0,0,0,.25))' });
      document.body.appendChild(cursor);
      addEventListener('mousemove', (event) => { cursor.style.transform = `translate(${event.clientX - 5}px, ${event.clientY - 3}px)`; }, true);
      addEventListener('mousedown', () => { cursor.style.scale = '0.82'; }, true);
      addEventListener('mouseup', () => { cursor.style.scale = '1'; }, true);
    };
    if (document.body) install(); else addEventListener('DOMContentLoaded', install);
  });
  const page = await context.newPage();
  // Record with Chrome's screencast at full device resolution (Playwright's recorder downsamples).
  const frameDir = join(RAW, `frames-${Date.now()}`);
  await mkdir(frameDir, { recursive: true });
  const frames = [];
  let cdp = null;
  if (record) {
    cdp = await context.newCDPSession(page);
    cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
      const file = join(frameDir, `${String(frames.length).padStart(6, '0')}.jpg`);
      frames.push({ file, t: metadata.timestamp });
      writeFileSync(file, Buffer.from(data, 'base64'));
      await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => { });
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: VIEW.width * SCALE, maxHeight: VIEW.height * SCALE, everyNthFrame: 1 });
  }
  const started = Date.now();
  await page.goto(`${BASE}${path}`);
  const marks = [];
  return {
    page,
    /** Note a moment (seconds since the page opened) so the film can cut on it. */
    mark(label) { const t = (Date.now() - started) / 1000; marks.push({ label, t }); console.log(`  ${t.toFixed(2)}s ${label}`); },
    async finish(name) {
      const endedAt = Date.now() / 1000;
      if (cdp) await cdp.send('Page.stopScreencast').catch(() => { });
      await sleep(300);
      await context.close();
      await browser.close();
      if (!record || !frames.length) return marks;
      // Frames arrive only when the page repaints; hold each until the next one, then resample to 30 fps.
      // Clip time 0 = page open, so marks line up with the video.
      const origin = started / 1000;
      const lines = ['ffconcat version 1.0'];
      frames.forEach((frame, index) => {
        const start = Math.max(frame.t, origin);
        const next = index + 1 < frames.length ? frames[index + 1].t : endedAt;
        if (next <= origin) return;
        if (lines.length === 1 && frame.t > origin) { lines.push(`file '${frame.file}'`, `duration ${(frame.t - origin).toFixed(4)}`); }
        lines.push(`file '${frame.file}'`, `duration ${Math.max(0.001, next - start).toFixed(4)}`);
      });
      lines.push(`file '${frames.at(-1).file}'`);
      const list = join(frameDir, 'list.ffconcat');
      writeFileSync(list, lines.join('\n'));
      const target = join(OUT, `${name}.mp4`);
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', `fps=30,scale=${VIEW.width * SCALE}:${VIEW.height * SCALE}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-an', target]);
      await rm(frameDir, { recursive: true });
      writeFileSync(join(OUT, `${name}.marks.json`), JSON.stringify(marks, null, 2));
      console.log(`saved ${target} (${frames.length} frames)`);
      return marks;
    },
  };
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Types like a person: slightly uneven gaps, short pause after spaces. */
export async function humanType(page, text, base = 55) {
  for (const char of text) {
    await page.keyboard.type(char);
    await sleep(base + (char === ' ' ? 40 : 0) + ((char.charCodeAt(0) * 37) % 30));
  }
}

/** Moves the mouse smoothly to an element's centre (so the recording shows a deliberate move). */
export async function glideTo(page, selector, steps = 28) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`No box for ${selector}`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps });
  return box;
}

/** Waits until a new @Vibe run exists for the party (beyond `before`) and every run has completed. */
export async function waitRunsDone(page, partyId) {
  await page.waitForFunction((id) => {
    const seen = (window.__waitedRuns ??= {});
    const runs = window.__director.store.runs[id];
    if (runs.length <= (seen[id] ?? 0) || !window.__director.runsDone(id)) return false;
    seen[id] = runs.length;
    return true;
  }, partyId, { timeout: 30_000 });
}

/** Pip sits bottom-right above the composer by default; this pins it to a fraction of the chat area. */
export const pipAt = (fx, fy) => ({ 'vibe.pip.position': JSON.stringify({ fx, fy }) });

export async function rename2(from, to) { await rename(from, to); }
