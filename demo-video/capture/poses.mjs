// Exports transparent PNGs of the real Pip component in chosen poses for film overlays.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { BASE } from './lib.mjs';

const out = new URL('../film/assets/pip/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const poses = [
  ['build', 'zoom'], ['build', 'present'], ['build', 'thinking'], ['build', 'working'],
  ['celebrate', 'present'], ['celebrate', 'wave'], ['celebrate', 'excited'],
  ['chill', 'curious'], ['chill', 'love'],
];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 800 }, deviceScaleFactor: 1 });
for (const [theme, state] of poses) {
  await page.goto(`${BASE}/pip.html?view=solo&bare=1&theme=${theme}&state=${state}`);
  await page.waitForTimeout(1600);
  await page.locator('#pip-bare').screenshot({ path: `${out}${theme}-${state}.png`, omitBackground: true });
  console.log(`${theme}-${state}`);
}
await browser.close();
