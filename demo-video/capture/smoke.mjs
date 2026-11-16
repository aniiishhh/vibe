// Quick check that the clone boots on mock data: screenshots of each route.
import { open, sleep } from './lib.mjs';

const shots = [
  ['/?scene=home', 'home'],
  ['/parties/p-class?scene=class-chatter', 'class'],
  ['/parties/p-trip?scene=trip-chatter', 'trip'],
  ['/memory?scene=memory', 'memory'],
  ['/pip.html?view=outfits', 'outfits'],
];
for (const [path, name] of shots) {
  const { page, finish } = await open({ path, record: false });
  page.on('pageerror', (error) => console.log(`[${name}] page error: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') console.log(`[${name}] console: ${message.text()}`); });
  await sleep(2500);
  await page.screenshot({ path: new URL(`./raw/smoke-${name}.png`, import.meta.url).pathname });
  await finish(name);
}
console.log('done');
