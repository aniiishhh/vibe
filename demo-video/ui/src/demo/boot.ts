/* Runs before the app: seeds Math.random so Pip's picks repeat on every take, then installs the mock API. */
const seedParam = Number(new URLSearchParams(window.location.search).get('seed') ?? '7');
let state = (Number.isFinite(seedParam) ? seedParam : 7) >>> 0;
Math.random = () => {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

await import('./mock-server');

export {};
