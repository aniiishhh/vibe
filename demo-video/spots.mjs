// Builds three short spotlight films (TinyFish, Supermemory, AWS) as separate HyperFrames projects.
// Each film is a list of beats; one beat = one voice line = one sub-composition. Run: node spots.mjs
import { writeFileSync, mkdirSync, readFileSync, existsSync, symlinkSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const W = 1920, H = 1080, F = 0.6;
const K = 1080 / 1003, DX = (W - 1568 * K) / 2;
const root = new URL('./', import.meta.url).pathname;
const assets = `${root}film/assets/`;
const dur = (file) => +(+execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString()).toFixed(3);
const words = (id) => JSON.parse(readFileSync(`${assets}voice/${id}.words.json`)).words;
/** Start time (s) of the first word in a voice line that starts with `w` (case-insensitive). */
const at = (id, w, nth = 0) => { const m = words(id).filter((x) => x.word.toLowerCase().replace(/[^a-z0-9.']/g, '').startsWith(w.toLowerCase())); if (!m[nth]) throw new Error(`${id}: no word ${w}`); return +m[nth].start.toFixed(2); };

const fonts = ['400', '500', '600', '700'].map((w) => `@font-face { font-family: 'Geist'; src: url('assets/fonts/geist-${w}.woff2') format('woff2'); font-weight: ${w}; }`).join('\n');
const baseCss = `
#root { position: absolute; inset: 0; overflow: hidden; background: #ffffff; font-family: 'Geist', sans-serif; color: #1f1b27; }
.cam { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; transform-origin: 0 0; }
.cam video, .cam img.still { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; object-fit: cover; display: block; }
.tagwrap { position: absolute; left: 200px; bottom: 132px; z-index: 40; }
.tag { display: flex; align-items: center; gap: 18px; padding: 18px 30px 18px 22px; background: #fff; border-radius: 14px; box-shadow: 0 12px 30px rgba(31,27,39,.18), 0 0 0 1px rgba(31,27,39,.06); font: 600 38px/1.1 'Geist'; white-space: nowrap; }
.tag i { display: block; width: 8px; height: 46px; border-radius: 4px; background: #ec5a44; }
.tag small { font-weight: 500; color: #5d5868; font-size: 30px; }
.world { position: absolute; inset: 0; background: #f6f6f8; }
.card { position: absolute; background: #fff; border-radius: 22px; box-shadow: 0 10px 30px rgba(31,27,39,.10), 0 0 0 1px rgba(31,27,39,.06); }
.row { position: absolute; left: 200px; width: 1000px; display: flex; gap: 30px; align-items: center; }
.row .ic { flex: none; width: 96px; height: 96px; border-radius: 24px; background: #fde8e4; color: #ec5a44; display: grid; place-items: center; font: 700 46px 'Geist'; }
.row b { display: block; font: 700 52px/1.1 'Geist'; letter-spacing: -0.02em; }
.row span { display: block; margin-top: 8px; font: 400 34px/1.25 'Geist'; color: #5d5868; }
.eyebrow { position: absolute; left: 200px; top: 150px; font: 600 34px 'Geist'; color: #ec5a44; }
.chip { position: absolute; padding: 16px 26px; background: #fff; border-radius: 14px; font: 600 32px 'Geist'; box-shadow: 0 12px 26px rgba(31,27,39,.16), 0 0 0 1px rgba(31,27,39,.06); white-space: nowrap; }
.mono { font-family: 'Geist', sans-serif; font-weight: 500; color: #3b3646; }
#dg { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; transform-origin: 0 0; }
#dg img { position: absolute; left: ${DX}px; top: 0; width: ${1568 * K}px; height: ${H}px; }
#dg svg { position: absolute; left: ${DX}px; top: 0; width: ${1568 * K}px; height: ${H}px; overflow: visible; }`;
const camJs = `
const F = ${F};
function camState(s, cx, cy) { let x = 960 - cx * F * s, y = 540 - cy * F * s; x = Math.min(0, Math.max(${W} - ${W} * s, x)); y = Math.min(0, Math.max(${H} - ${H} * s, y)); return { scale: s, x, y }; }
function cam(tl, sel, t, d, s, cx, cy, ease) { tl.to(sel, { ...camState(s, cx, cy), duration: d, ease: ease || 'power3.inOut' }, t); }
function camSet(tl, sel, t, s, cx, cy) { tl.set(sel, camState(s, cx, cy), t); }
function tagIn(tl, sel, t, d) { tl.fromTo(sel, { opacity: 0, filter: 'blur(8px)', x: -14 }, { opacity: 1, filter: 'blur(0px)', x: 0, duration: 0.2, ease: 'expo.out' }, t); tl.to(sel, { opacity: 0, filter: 'blur(6px)', duration: 0.14, ease: 'power2.in' }, t + d - 0.16); }
function pop(tl, sel, t) { tl.fromTo(sel, { opacity: 0, y: 24, filter: 'blur(6px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.45, ease: 'expo.out' }, t); }`;

// ---------- building blocks (each returns { html, js }) ----------
let uid = 0;
const seg = (b, { start, len, clip, from, rate = 1, cams = [] }) => {
  const k = `${b}-c${uid++}`;
  return {
    html: `<div class="cam" id="${k}"><video id="${k}v" class="clip" src="assets/clips/${clip}.mp4" muted playsinline data-start="${start}" data-duration="${len}" data-media-start="${from}" data-playback-rate="${rate}" data-track-index="1"></video></div>`,
    js: cams.map(([t, d, s, cx, cy], i) => (i === 0 && d === 0 ? `camSet(tl, '#${k}', 0, ${s}, ${cx}, ${cy});` : `cam(tl, '#${k}', ${t}, ${d}, ${s}, ${cx}, ${cy});`)).join('\n'),
    id: k,
  };
};
const still = (b, { start, len, src, cams = [], extra = '' }) => {
  const k = `${b}-s${uid++}`;
  return {
    html: `<div class="cam" id="${k}"><img class="still clip" id="${k}i" src="${src}" alt="" data-start="${start}" data-duration="${len}" data-track-index="1" />${extra}</div>`,
    js: cams.map(([t, d, s, cx, cy], i) => (i === 0 && d === 0 ? `camSet(tl, '#${k}', 0, ${s}, ${cx}, ${cy});` : `cam(tl, '#${k}', ${t}, ${d}, ${s}, ${cx}, ${cy});`)).join('\n'),
  };
};
const tag = (b, text, start, len, sub = '') => {
  const k = `${b}-t${uid++}`;
  return { html: `<div class="clip tagwrap" id="${k}" data-start="${start}" data-duration="${len}" data-track-index="5"><div class="tag" id="${k}i"><i></i><span>${text}${sub ? ` <small>${sub}</small>` : ''}</span></div></div>`, js: `tagIn(tl, '#${k}i', ${start}, ${len});` };
};
/** A drawn world (graphic) shown over [start, start+len). Children with ids are animated by `js`. */
const world = (b, start, len, inner, js = '') => {
  const k = `${b}-w${uid++}`;
  return { html: `<div class="clip" id="${k}" data-start="${start}" data-duration="${len}" data-track-index="2" style="position:absolute;inset:0;z-index:20"><div class="world" id="${k}g">${inner}</div></div>`, js: `tl.fromTo('#${k}g', { opacity: 0, filter: 'blur(8px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.22, ease: 'expo.out' }, ${start});\n${js}` };
};
// AWS diagram with highlight boxes and an optional travelling dot. views: [[t, rect, max]], hl: [[id, rect, in, out]], dot: [[x,y,t]]
const diagram = (b, { start, len, views = [], hl = [], dot = null, inner = '' }) => {
  const view = ([x0, y0, x1, y1], max = 1.85) => {
    const fx0 = DX + x0 * K, fy0 = y0 * K, fx1 = DX + x1 * K, fy1 = y1 * K;
    const s = Math.min(max, Math.min(W / (fx1 - fx0), H / (fy1 - fy0)) * 0.9);
    let x = W / 2 - ((fx0 + fx1) / 2) * s, y = H / 2 - ((fy0 + fy1) / 2) * s;
    x = Math.min(0, Math.max(W - W * s, x)); y = Math.min(0, Math.max(H - H * s, y));
    return `{ scale: ${s.toFixed(3)}, x: ${x.toFixed(1)}, y: ${y.toFixed(1)} }`;
  };
  const rects = hl.map(([id, [x0, y0, x1, y1]]) => `<rect id="${b}-h-${id}" x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" rx="12" pathLength="1" fill="rgba(236,90,68,.08)" stroke="#ec5a44" stroke-width="4" stroke-dasharray="1" stroke-dashoffset="1" opacity="0" />`).join('');
  const dotSvg = dot ? `<circle id="${b}-dot" cx="${dot[0][0]}" cy="${dot[0][1]}" r="11" fill="#ec5a44" stroke="#fff" stroke-width="4" opacity="0" />` : '';
  const js = [
    views.length ? `tl.set('#dg', ${view(views[0][1], views[0][2])}, 0);` : `tl.set('#dg', { scale: 1, x: 0, y: 0 }, 0);`,
    ...views.slice(1).map(([t, r, max]) => `tl.to('#dg', { ...${view(r, max)}, duration: 0.6, ease: 'power3.inOut' }, ${t});`),
    ...hl.map(([id, , tin, tout]) => `tl.fromTo('#${b}-h-${id}', { opacity: 0, attr: { 'stroke-dashoffset': 1 } }, { opacity: 1, attr: { 'stroke-dashoffset': 0 }, duration: 0.45, ease: 'power2.out' }, ${tin});${tout ? `\ntl.to('#${b}-h-${id}', { opacity: 0, duration: 0.25 }, ${tout});` : ''}`),
    ...(dot ? [`tl.fromTo('#${b}-dot', { opacity: 0 }, { opacity: 1, duration: 0.2 }, ${dot[0][2]});`, ...dot.slice(1).map(([x, y, t], i) => `tl.to('#${b}-dot', { attr: { cx: ${x}, cy: ${y} }, duration: ${Math.min(0.55, t - dot[i][2]).toFixed(2)}, ease: 'power2.inOut' }, ${(t - Math.min(0.55, t - dot[i][2])).toFixed(2)});`)] : []),
  ].join('\n');
  return { html: `<div class="clip" id="${b}-dgwrap" data-start="${start}" data-duration="${len}" data-track-index="1" style="position:absolute;inset:0;background:#fff"><div id="dg" data-layout-allow-overflow><img src="assets/stills/aws-architecture.png" alt="Vibe AWS architecture" /><svg viewBox="0 0 1568 1003">${rects}${dotSvg}</svg>${inner}</div></div>`, js };
};
const mark = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><path d="M1.3 5.1Q12 8.9 22.7 5.1" fill="none" stroke="#3b3646" stroke-width="1.3" stroke-linecap="round"/><path d="M2.5 5.6Q4.5 6.2 6.5 6.6L5.05 11.9Q4.5 13.1 3.95 11.9Z" fill="#f2b33d"/><path d="M17.5 6.6Q19.5 6.2 21.5 5.6L20.05 11.9Q19.5 13.1 18.95 11.9Z" fill="#2fb3b8"/><path d="M7.3 6.75Q12 7.95 16.7 6.75L12.9 19.7Q12 21.3 11.1 19.7Z" fill="#ec5a44"/></svg>`;
const endCard = (b, partner, line, pip, len) => ({
  html: `<div class="clip" id="${b}-end" data-start="0" data-duration="${len}" data-track-index="1" style="position:absolute;inset:0;background:#fff">
  <div id="${b}-lock" style="position:absolute;left:0;top:300px;width:${W}px;display:flex;justify-content:center;align-items:center;gap:30px">
    <div id="${b}-mk">${mark(170)}</div><div id="${b}-wd" style="font:700 150px/1 'Geist';letter-spacing:-0.04em">vibe</div>
    <div id="${b}-x" style="font:400 90px 'Geist';color:#b0aab8;margin:0 10px">×</div><div id="${b}-pt" style="font:700 120px/1 'Geist';letter-spacing:-0.03em;color:#1f1b27">${partner}</div>
  </div>
  <div id="${b}-ln" style="position:absolute;left:0;width:${W}px;top:560px;text-align:center;font:600 56px 'Geist';letter-spacing:-0.02em">${line}</div>
  <div id="${b}-url" style="position:absolute;left:50%;top:690px;transform:translateX(-50%);padding:18px 40px;border-radius:18px;background:#ec5a44;color:#fff;font:600 48px 'Geist'">vibe-chat.us</div>
  <div id="${b}-cr" style="position:absolute;left:0;width:${W}px;top:860px;text-align:center;font:500 32px 'Geist';color:#3b3646">Built by Anish &amp; Bhavesh · SunHacks 2026 · demo data</div>
  <img id="${b}-pip" src="assets/pip/${pip}.png" alt="" style="position:absolute;left:0;top:0;width:300px" />
</div>`,
  js: `
tl.fromTo('#${b}-mk', { scale: 0.4, opacity: 0, rotation: -14 }, { scale: 1, opacity: 1, rotation: 0, duration: 0.5, ease: 'back.out(1.6)' }, 0.15);
tl.fromTo('#${b}-wd', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.4, ease: 'power3.out' }, 0.45);
tl.fromTo('#${b}-x', { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0.8);
tl.fromTo('#${b}-pt', { opacity: 0, x: 40, filter: 'blur(8px)' }, { opacity: 1, x: 0, filter: 'blur(0px)', duration: 0.4, ease: 'expo.out' }, 0.9);
tl.fromTo('#${b}-ln', { opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.25 }, 1.5);
tl.fromTo('#${b}-url', { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.8)' }, 2.3);
tl.fromTo('#${b}-cr', { opacity: 0 }, { opacity: 1, duration: 0.3 }, 2.7);
tl.fromTo('#${b}-pip', { x: 2000, y: 700, rotation: 14 }, { x: 1500, y: 480, rotation: 0, duration: 0.8, ease: 'back.out(1.4)' }, 0.3);`,
});

// ---------- film writer ----------
function film(name, { beats, music }) {
  const dir = `${root}film-${name}/`;
  mkdirSync(`${dir}compositions`, { recursive: true });
  if (!existsSync(`${dir}assets`)) symlinkSync('../film/assets', `${dir}assets`);
  for (const f of ['hyperframes.json', 'meta.json']) copyFileSync(`${root}film/${f}`, `${dir}${f}`);
  writeFileSync(`${dir}package.json`, JSON.stringify({ name: `vibe-${name}`, private: true, type: 'module', scripts: { dev: 'npx --yes hyperframes@0.9.53 preview', check: 'npx --yes hyperframes@0.9.53 check', render: 'npx --yes hyperframes@0.9.53 render' } }, null, 2));
  let t = 0;
  const hosts = [], audio = [];
  beats.forEach((beat, i) => {
    const id = `${name}-${i + 1}`;
    const voLen = beat.vo ? dur(`${assets}voice/${beat.vo}.norm.mp3`) : 0;
    const len = +(beat.len ?? voLen + (beat.pad ?? 0.45)).toFixed(2);
    const parts = beat.parts(id, len);
    writeFileSync(`${dir}compositions/${id}.html`, `<template>
  <style>${fonts}${baseCss}${beat.css ?? ''}</style>
  <div id="root" data-composition-id="${id}" data-width="${W}" data-height="${H}" data-duration="${len}">
${parts.map((p) => p.html).join('\n')}
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
${camJs}
${parts.map((p) => p.js).join('\n')}
    window.__timelines["${id}"] = tl;
  </script>
</template>
`);
    hosts.push(`      <div id="${id}" data-composition-id="${id}" data-composition-src="compositions/${id}.html" data-start="${t.toFixed(2)}" data-duration="${len}" data-track-index="${(i % 2) + 1}" data-track-kind="graphics" data-width="${W}" data-height="${H}" style="z-index:${i + 1}"></div>`);
    if (beat.vo) audio.push(`      <audio id="vo-${beat.vo}" class="clip" src="assets/voice/${beat.vo}.norm.mp3" data-start="${(t + 0.2).toFixed(2)}" data-duration="${voLen}" data-track-index="10" data-volume="1"></audio>`);
    (beat.fx ?? []).forEach(([fx, ft, vol], j) => audio.push(`      <audio id="fx-${i}-${j}-${fx}" class="clip" src="assets/sfx/${fx}.norm.mp3" data-start="${Math.max(0, t + ft).toFixed(2)}" data-duration="${dur(`${assets}sfx/${fx}.norm.mp3`)}" data-track-index="${12 + (j % 3)}" data-volume="${vol}"></audio>`));
    t += len;
  });
  const total = +t.toFixed(2);
  writeFileSync(`${dir}index.html`, `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>${fonts}
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: #fff; }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; background: #fff; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="${W}" data-height="${H}">
${hosts.join('\n')}
      <audio id="music-bed" class="clip" src="assets/music/bed.mp3" data-start="0" data-duration="${total}" data-media-start="${music}" data-track-index="11" data-volume="0.14" data-fade-in="0.8" data-fade-out="2.0"></audio>
${audio.join('\n')}
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`);
  console.log(`film-${name}: ${beats.length} beats, ${total}s`);
}

const tw = (b, len) => []; // placeholder to keep beat signature readable
void tw;

// ======================= 1. TinyFish =======================
film('tinyfish', {
  music: 12,
  beats: [
    { vo: 'tf1', fx: [['pop-2', 2.1, 0.3]], parts: (b) => [
      seg(b, { start: 0, len: 6, clip: 'trip', from: 0.6, cams: [[0, 0, 1.0, 1600, 900], [0.6, 0.6, 1.35, 1500, 760]] }),
      tag(b, 'Live web research', 1.6, 3.9, 'with TinyFish'),
    ] },
    { vo: 'tf2', fx: [['pop-1', 1.7, 0.3], ['pop-1', 3.6, 0.3], ['pop-1', 4.9, 0.3], ['pop-2', 6.2, 0.32]], css: `
.flow { position: absolute; left: 1110px; top: 150px; width: 680px; padding: 26px 30px; background: #fff; border-radius: 22px; box-shadow: 0 16px 40px rgba(31,27,39,.18), 0 0 0 1px rgba(31,27,39,.06); z-index: 30; }
.flow h4 { font: 600 28px 'Geist'; color: #ec5a44; margin-bottom: 18px; }
.flow p { font: 500 30px/1.3 'Geist'; padding: 14px 0; border-top: 1px solid #eeecf1; }
.flow p em { font-style: normal; color: #5d5868; font-weight: 400; display: block; font-size: 28px; }`, parts: (b, len) => {
      const s = at('tf2', 'search'), f = at('tf2', 'fetches');
      return [
        seg(b, { start: 0, len, clip: 'tinyfish', from: 3.0, cams: [[0, 0, 1.0, 1600, 900], [6.25, 0.55, 1.5, 1500, 1000]] }),
        { html: `<div class="clip" id="${b}-fw" data-start="1.2" data-duration="5.3" data-track-index="3"><div class="flow" id="${b}-flow"><h4>Behind the scenes · TinyFish</h4><p id="${b}-p1">Search <em>“Sedona Flagstaff forecast Saturday”</em></p><p id="${b}-p2">Fetch → markdown <em>forecast.weather.gov · Sedona</em></p><p id="${b}-p3">Fetch → markdown <em>forecast.weather.gov · Flagstaff</em></p></div></div>`,
          js: `pop(tl, '#${b}-flow', 1.2); pop(tl, '#${b}-p1', ${s}); pop(tl, '#${b}-p2', ${f}); pop(tl, '#${b}-p3', ${(f + 0.45).toFixed(2)}); tl.to('#${b}-flow', { opacity: 0, filter: 'blur(6px)', duration: 0.15 }, 6.3);` },
        tag(b, 'Fresh fetch every time', at('tf2', 'fresh'), len - at('tf2', 'fresh') - 0.1),
      ];
    } },
    { vo: 'tf3', fx: [['click', 0.3, 0.4]], parts: (b, len) => [
      seg(b, { start: 0, len, clip: 'tinyfish', from: 13.4, cams: [[0, 0, 1.5, 1500, 1050], [0.55, 0.55, 2.2, 1160, 1335]] }),
      tag(b, 'Source + retrieval time', 1.6, len - 1.7, 'on every claim'),
    ] },
    { vo: 'tf4', fx: [['pop-2', 0.2, 0.3], ['pop-1', 3.7, 0.32], ['click', 6.5, 0.4]], parts: (b, len) => [
      seg(b, { start: 0, len, clip: 'tinyfish', from: 17.0, rate: 1.75, cams: [[0, 0, 1.4, 1500, 1000], [3.8, 0.5, 1.6, 1450, 1080], [6.4, 0.45, 2.0, 1160, 1330]] }),
      tag(b, 'Official park pages', 4.0, len - 4.1, 'azstateparks.com'),
    ] },
    { vo: 'tf5', fx: [['pop-1', 0.35, 0.3], ['pop-2', at('tf5', 'each'), 0.3], ['pop-1', at('tf5', 'and', 1), 0.3]], parts: (b, len) => [
      world(b, 0, len, `
<div class="eyebrow">How Vibe uses TinyFish safely</div>
<div class="row" id="${b}-r1" style="top:250px"><div class="ic">✓</div><div><b>Fetch only what search found</b><span>Public pages only. No invented URLs or citation IDs.</span></div></div>
<div class="row" id="${b}-r2" style="top:480px"><div class="ic">2·3</div><div><b>2 searches · 3 fetches per reply</b><span>Bounded tool loop with 10–22 s timeouts, so answers stay fast.</span></div></div>
<div class="row" id="${b}-r3" style="top:710px"><div class="ic">🔒</div><div><b>Key stays on the server</b><span>Encrypted in AWS SSM Parameter Store, read by Lambda via IAM.</span></div></div>
<img src="assets/pip/build-thinking.png" alt="" id="${b}-pip" style="position:absolute;left:1330px;top:300px;width:460px" />`,
      `pop(tl, '#${b}-r1', 0.35); pop(tl, '#${b}-r2', ${at('tf5', 'each')}); pop(tl, '#${b}-r3', ${at('tf5', 'and', 1)}); tl.fromTo('#${b}-pip', { x: 300, rotation: 10 }, { x: 0, rotation: 0, duration: 0.7, ease: 'back.out(1.5)' }, 0.5); tl.to('#${b}-pip', { y: -40, rotation: -6, duration: 0.25, ease: 'power2.out', yoyo: true, repeat: 1 }, ${at('tf5', 'each')}); tl.to('#${b}-pip', { y: -40, rotation: 6, duration: 0.25, ease: 'power2.out', yoyo: true, repeat: 1 }, ${at('tf5', 'and', 1)});`),
    ] },
    { vo: 'tf6', pad: 1.4, fx: [['riser', -0.6, 0.45]], parts: (b, len) => [endCard(b, 'TinyFish', 'Live web research in your group chat', 'build-present', len)] },
  ],
});

// ======================= 2. Supermemory =======================
const spaces = (b) => `
<div class="card" id="${b}-cls" style="left:190px;top:150px;width:640px;height:300px"><div style="padding:26px 30px;font:600 34px 'Geist'">📘 Classes next semester</div><div style="position:absolute;left:30px;right:30px;top:110px;padding:18px 22px;border-radius:18px;background:hsl(220 90% 94%);font:400 29px/1.3 'Geist'">…also I’m vegetarian lol</div><div style="position:absolute;left:30px;bottom:26px;font:500 28px 'Geist';color:#5d5868">Party space</div></div>
<div class="card" id="${b}-trp" style="left:190px;top:600px;width:640px;height:300px"><div style="padding:26px 30px;font:600 34px 'Geist'">⛰️ Saturday day trip</div><div style="position:absolute;left:30px;right:30px;top:110px;padding:18px 22px;border-radius:18px;background:#f3f2f6;font:400 29px/1.3 'Geist';color:#5d5868">Vibe plans the day here</div><div style="position:absolute;left:30px;bottom:26px;font:500 28px 'Geist';color:#5d5868">Party space</div></div>
<div class="card" id="${b}-mem" style="left:1090px;top:150px;width:640px;height:750px"><div style="padding:26px 30px;font:600 34px 'Geist'">Maya’s memory</div>
  <div id="${b}-prv" style="position:absolute;left:30px;right:30px;top:110px;height:280px;border:3px dashed #d6d3dd;border-radius:18px"><b style="position:absolute;left:22px;top:18px;font:600 32px 'Geist'">Private</b><span style="position:absolute;left:22px;top:62px;font:400 28px 'Geist';color:#5d5868">Only Maya sees it</span></div>
  <div id="${b}-apr" style="position:absolute;left:30px;right:30px;top:420px;height:280px;border:3px dashed #d6d3dd;border-radius:18px"><b style="position:absolute;left:22px;top:18px;font:600 32px 'Geist'">Approved</b><span style="position:absolute;left:22px;top:62px;font:400 28px 'Geist';color:#5d5868">Used where she opts in</span></div>
</div>
<div style="position:absolute;left:1090px;top:922px;font:500 28px 'Geist';color:#5d5868">Separate Supermemory spaces per party and per person</div>
<div class="chip" id="${b}-tok" style="left:0;top:0"><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#ec5a44;margin-right:12px"></span>Vegetarian</div>`;
const vegMark = `<div style="position:absolute;left:${1310 * F}px;top:${968 * F}px;width:${278 * F}px;height:${44 * F}px;background:rgba(236,90,68,.22);border-bottom:3px solid #ec5a44;border-radius:4px;transform-origin:0 50%;transform:scaleX(0)" class="vegmark"></div>`;
// Ring in clip pixels, drawn inside a seg's camera so it tracks zooms.
const ring = (sg, id, [x, y, w, h], t) => {
  sg.html = sg.html.replace('</div>', `<div id="${id}" style="position:absolute;left:${x * F}px;top:${y * F}px;width:${w * F}px;height:${h * F}px;border:3px solid #ec5a44;border-radius:12px;box-shadow:0 0 0 6px rgba(236,90,68,.15);opacity:0"></div></div>`);
  sg.js += `\ntl.fromTo('#${id}', { opacity: 0, scale: 1.08 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'expo.out' }, ${t});`;
  return sg;
};
film('supermemory', {
  music: 46,
  beats: [
    { vo: 'sm1', fx: [['sparkle', 0.6, 0.35]], parts: (b, len) => [
      diagram(b, { start: 0, len, views: [[0, [980, 300, 1568, 720], 1.7]], hl: [['sm', [1386, 504, 1554, 606], 0.5], ['mw', [992, 532, 1074, 650], 0.9]] }),
      tag(b, 'Powered by Supermemory', 1.1, len - 1.2),
    ] },
    { vo: 'sm2', fx: [['pop-1', 0.12, 0.3], ['pop-2', 0.97, 0.3], ['pop-1', 1.83, 0.3], ['sparkle', 3.85, 0.35], ['whoosh-2', 6.6, 0.2], ['sparkle', 7.3, 0.3]], parts: (b, len) => {
      const h = ring(seg(b, { start: 0, len: 6.7, clip: 'hook', from: 2.3, cams: [[0, 0, 1.0, 1600, 900], [3.2, 0.6, 1.6, 2420, 770]] }), `${b}-ring`, [1862, 724, 1134, 90], 3.85);
      const m = ring(seg(b, { start: 6.7, len: len - 6.7, clip: 'memory', from: 3.92, rate: 0.1, cams: [[0, 0, 2.0, 1450, 930]] }), `${b}-ring2`, [1088, 806, 700, 246], 7.3);
      return [h,
        tag(b, 'No @Vibe needed', 3.4, 3.2),
        m,
        tag(b, 'Learned in the background', 6.9, len - 7.0, '2 min after the chat goes quiet'),
      ];
    } },
    { vo: 'sm3', fx: [['pop-1', 0.4, 0.3], ['whoosh-1', at('sm3', 'new') + 0.2, 0.2], ['pop-2', at('sm3', 'private', 1), 0.32]], parts: (b, len) => {
      const n = at('sm3', 'new');
      return [world(b, 0, len, spaces(b), `
['#${b}-cls', '#${b}-trp', '#${b}-mem'].forEach((s, i) => pop(tl, s, 0.3 + i * 0.1));
tl.fromTo('#${b}-prv', { opacity: 0 }, { opacity: 1, duration: 0.3 }, ${at('sm3', 'private')});
tl.fromTo('#${b}-apr', { opacity: 0 }, { opacity: 1, duration: 0.3 }, ${at('sm3', 'approved')});
tl.fromTo('#${b}-tok', { x: 470, y: 280, scale: 0.6, opacity: 0 }, { x: 470, y: 280, scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.8)' }, ${(n - 0.3).toFixed(2)});
tl.to('#${b}-tok', { x: 1160, y: 420, duration: 0.8, ease: 'power2.inOut' }, ${(n + 0.2).toFixed(2)});
tl.to('#${b}-prv', { borderColor: '#ec5a44', duration: 0.3 }, ${(n + 1.0).toFixed(2)});`)];
    } },
    { vo: 'sm4', fx: [['click', 1.77, 0.4], ['click', 4.45, 0.4]], parts: (b, len) => [
      ring(seg(b, { start: 0, len: 2.9, clip: 'memory', from: 3.6, rate: 0.4, cams: [[0, 0, 1.9, 1500, 950]] }), `${b}-r1`, [1088, 994, 252, 52], 1.3),
      tag(b, 'Maya approves', 0.3, 2.5),
      ring(seg(b, { start: 2.9, len: len - 2.9, clip: 'memory', from: 10.4, rate: 0.9, cams: [[0, 0, 1.7, 2860, 430]] }), `${b}-r2`, [2545, 372, 630, 100], 3.9),
      tag(b, 'Opt in per party', 3.1, len - 3.2),
    ] },
    { vo: 'sm5', fx: [['pop-1', 0.4, 0.3], ['pop-2', 1.6, 0.3], ['pop-2', 2.6, 0.3], ['pop-1', 4.2, 0.3], ['whoosh-2', 7.2, 0.2], ['confetti', 7.2 + 1.85 + 0.2, 0.35], ['sparkle', at('sm5', 'vegetarian') + 0.1, 0.35]], css: `
.q { position: absolute; left: 180px; top: 440px; }
.src { position: absolute; left: 820px; width: 560px; padding: 24px 28px; }
.src b { display: block; font: 600 34px 'Geist'; } .src span { display: block; margin-top: 8px; font: 400 28px/1.3 'Geist'; color: #5d5868; }
.badge { display: inline-block; margin: 12px 10px 0 0; padding: 6px 14px; border-radius: 10px; background: #fde8e4; color: #b2402f; font: 600 28px 'Geist'; }
.ans { position: absolute; left: 1470px; top: 400px; width: 300px; padding: 26px; }`, parts: (b, len) => {
      const v = at('sm5', 'vegetarian');
      const t = seg(b, { start: 7.2, len: len - 7.2, clip: 'trip', from: 33.3, cams: [[0, 0, 1.35, 1550, 850], [v - 0.5, 0.55, 2.1, 1530, 995]] });
      t.html = t.html.replace('</div>', `${vegMark.replace('class="vegmark"', `id="${b}-vm"`)}</div>`);
      t.js += `\ntl.fromTo('#${b}-vm', { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: 'power2.out' }, ${(v - 0.1).toFixed(2)});`;
      return [world(b, 0, 7.2, `
<div class="chip q" id="${b}-q"><span style="color:#ec5a44">@Vibe</span> plan our day?</div>
<svg style="position:absolute;inset:0" width="1920" height="1080"><path id="${b}-l1" d="M560 470 C 680 470, 700 300, 820 300" stroke="#ec5a44" stroke-width="4" fill="none" opacity="0"/><path id="${b}-l2" d="M560 490 C 680 490, 700 640, 820 640" stroke="#ec5a44" stroke-width="4" fill="none" opacity="0"/><path id="${b}-l3" d="M1380 300 C 1420 300, 1430 470, 1470 470 M1380 640 C 1420 640, 1430 500, 1470 500" stroke="#ec5a44" stroke-width="4" fill="none" opacity="0"/></svg>
<div class="card src" id="${b}-s1" style="top:200px"><b>Party history</b><span>Supermemory chunk search over this party’s chat</span></div>
<div class="card src" id="${b}-s2" style="top:540px"><b>Approved facts</b><span>Only members who opted in, up to 5 each</span><div><i class="badge">Schedule</i><i class="badge">Diet</i><i class="badge">Accessibility</i></div></div>
<div class="card ans" id="${b}-a"><b style="font:600 34px 'Geist'">DynamoDB check</b><span style="display:block;margin-top:8px;font:400 28px/1.3 'Geist';color:#5d5868">Still approved? Still opted in? Then answer.</span></div>`,
      `pop(tl, '#${b}-q', 0.3); tl.to('#${b}-l1', { opacity: 1, duration: 0.3 }, 1.4); tl.to('#${b}-l2', { opacity: 1, duration: 0.3 }, 2.4); pop(tl, '#${b}-s1', 1.5); pop(tl, '#${b}-s2', 2.5); tl.to('#${b}-l3', { opacity: 1, duration: 0.3 }, 4.0); pop(tl, '#${b}-a', 4.1);`),
      t, tag(b, 'From Maya’s approved memory', v + 0.1, len - v - 0.2)];
    } },
    { vo: 'sm6', fx: [['pop-1', 0.5, 0.3], ['pop-2', 1.4, 0.3], ['sparkle', 2.6, 0.35], ['keys', 4.3, 0.25], ['click', 6.99, 0.4], ['sparkle', 7.35, 0.3], ['pop-1', at('sm6', 'every') + 0.3, 0.3], ['boing', at('sm6', 'deleted') + 0.6, 0.3]], parts: (b, len) => {
      const e = at('sm6', 'every');
      return [
        world(b, 0, 4.1, `
<div class="eyebrow">Supermemory consolidates repeats</div>
<div class="chip" id="${b}-m1" style="left:300px;top:340px;background:hsl(220 90% 94%)">I’m vegetarian</div>
<div class="chip" id="${b}-m2" style="left:300px;top:520px;background:hsl(220 90% 94%)">veggie only for me lol</div>
<div class="chip" id="${b}-f" style="left:1150px;top:430px;font-size:40px"><span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:#ec5a44;margin-right:14px"></span>Vegetarian · 1 fact</div>`,
        `pop(tl, '#${b}-m1', 0.4); pop(tl, '#${b}-m2', 0.9); tl.to(['#${b}-m1', '#${b}-m2'], { x: 700, y: (i) => (i ? -90 : 90), opacity: 0, scale: 0.8, duration: 0.6, ease: 'power2.in' }, 2.4); pop(tl, '#${b}-f', 2.8);`),
        ring(seg(b, { start: 4.1, len: +(e - 4.1 + 0.2).toFixed(2), clip: 'memory2', from: 8.0, rate: 1.0, cams: [[0, 0, 1.6, 1850, 1250], [6.95, 0.5, 1.8, 1700, 900]] }), `${b}-r`, [1095, 866, 640, 74], 7.35),
        tag(b, 'Edits apply on the next answer', 4.4, e - 4.4),
        world(b, +(e + 0.2).toFixed(2), +(len - e - 0.2).toFixed(2), `
<div class="eyebrow">DynamoDB is the source of truth</div>
<div class="card" style="left:200px;top:280px;width:700px;height:400px;padding:30px"><b style="font:600 36px 'Geist'">Supermemory results</b>
  <div class="chip" style="position:relative;margin-top:30px;display:inline-block">Vegan. No meat, dairy or eggs.</div><br/>
  <div class="chip" id="${b}-old" style="position:relative;margin-top:24px;display:inline-block;color:#8a8594">Vegetarian (deleted)<div id="${b}-x" style="position:absolute;left:18px;right:18px;top:50%;height:4px;background:#ec5a44;transform-origin:0 50%;transform:scaleX(0)"></div></div></div>
<div class="card" style="left:1050px;top:330px;width:660px;height:300px;padding:30px"><b style="font:600 36px 'Geist'">Re-checked in DynamoDB</b><span style="display:block;margin-top:14px;font:400 30px/1.35 'Geist';color:#5d5868">Ownership, approval, version, opt-in. Stale or deleted facts are dropped.</span></div>`,
        `tl.fromTo('#${b}-x', { scaleX: 0 }, { scaleX: 1, duration: 0.35, ease: 'power2.out' }, ${(at('sm6', 'deleted') - e + 0.4).toFixed(2)}); tl.to('#${b}-old', { opacity: 0.4, duration: 0.3 }, ${(at('sm6', 'deleted') - e + 0.6).toFixed(2)});`.replace(/(\d+\.\d+)\)/g, (m, n) => `${(+n + e + 0.2).toFixed(2)})`)),
      ];
    } },
    { vo: 'sm7', pad: 1.4, fx: [['riser', -0.6, 0.45]], parts: (b, len) => [endCard(b, 'Supermemory', 'Memory with consent', 'chill-love', len)] },
  ],
});

// ======================= 3. AWS =======================
const ops = { cdk: [150, 818, 382, 902], cw: [392, 818, 602, 902], ssm: [604, 818, 872, 902], iam: [874, 818, 1082, 902], evb: [1086, 818, 1306, 902] };
film('aws', {
  music: 12,
  beats: [
    { vo: 'aw1', fx: [['whoosh-1', 0.1, 0.3]], parts: (b, len) => {
      const d = diagram(b, { start: 0, len, views: [[0, [0, 0, 1568, 1003], 1]], dot: [[80, 418, 1.4]], hl: [['l1', [62, 945, 335, 992], 2.0], ['l2', [372, 945, 600, 992], 2.6], ['l3', [640, 945, 958, 992], 3.2], ['l4', [990, 945, 1248, 992], 3.8], ['l5', [1282, 945, 1532, 992], 4.4]] });
      d.js += `\ntl.fromTo('#dg', { scale: 1.12, x: -115, y: -65, opacity: 0.55 }, { scale: 1, x: 0, y: 0, opacity: 1, duration: 1.0, ease: 'expo.out' }, 0);`;
      return [d, tag(b, 'Built on AWS', 1.6, len - 1.7, '15+ managed services')];
    } },
    { vo: 'aw2', fx: [['whoosh-2', 0.05, 0.16]], parts: (b, len) => [
      diagram(b, { start: 0, len, views: [[0, [0, 0, 1568, 1003], 1], [0.1, [100, 220, 430, 560]]], hl: [['cf', [196, 258, 410, 392], at('aw2', 'cloudfront')], ['cog', [300, 418, 392, 530], at('aw2', 'cognito')]], dot: [[80, 418, 0]] }),
      tag(b, 'vibe-chat.us', at('aw2', 'cloudfront') + 0.4, 2.4, 'CloudFront + S3'),
    ] },
    { vo: 'aw3', fx: [['whoosh-3', 0.05, 0.16], ['pop-1', at('aw3', 'dynamodb') + 0.3, 0.3]], parts: (b, len) => [
      diagram(b, { start: 0, len, views: [[0, [100, 220, 430, 560]], [0.1, [270, 430, 800, 690]]], hl: [['gw', [288, 540, 384, 662], at('aw3', 'api')], ['lam', [444, 466, 532, 598], at('aw3', 'lambda')], ['ddb', [548, 462, 636, 646], at('aw3', 'dynamodb')]],
        dot: [[80, 418, 0], [124, 592, 0.6], [335, 592, at('aw3', 'api') + 0.3], [488, 520, at('aw3', 'lambda') + 0.2], [590, 520, at('aw3', 'dynamodb') + 0.3]] }),
      tag(b, 'One transaction', at('aw3', 'single'), len - at('aw3', 'single') - 0.1, 'message + outbox'),
    ] },
    { vo: 'aw4', fx: [['whoosh-1', 0.05, 0.16]], parts: (b, len) => [
      diagram(b, { start: 0, len, views: [[0, [270, 430, 800, 690]], [0.1, [540, 340, 980, 660]]], hl: [['ddb', [548, 462, 636, 646], 0.2, at('aw4', 'dispatcher')], ['st', [630, 470, 710, 520], at('aw4', 'streams')], ['disp', [696, 462, 784, 600], at('aw4', 'dispatcher')], ['sqs', [850, 372, 936, 508], at('aw4', 'sqs')], ['sqm', [850, 532, 936, 660], at('aw4', 'sqs') + 0.3]],
        dot: [[590, 520, 0], [740, 520, at('aw4', 'dispatcher') + 0.2], [892, 430, at('aw4', 'sqs') + 0.3], [892, 600, at('aw4', 'sqs') + 1.6], [1033, 600, at('aw4', 'sqs') + 2.4]] }),
      tag(b, 'SQS FIFO', at('aw4', 'fifo') + 0.2, len - at('aw4', 'fifo') - 0.3, 'ordered per party'),
    ] },
    { vo: 'aw5', fx: [['sparkle', at('aw5', 'bedrock'), 0.35], ['whoosh-2', at('aw5', 'even') - 0.3, 0.2], ['click', at('aw5', 'even') + 0.05, 0.4]], parts: (b, len) => {
      const ev = +(at('aw5', 'even') - 0.3).toFixed(2);
      return [
        diagram(b, { start: 0, len: ev, views: [[0, [540, 340, 980, 660]], [0.1, [860, 250, 1568, 700], 1.6]], hl: [['wk', [992, 372, 1074, 502], 0.4], ['bed', [1170, 444, 1268, 594], at('aw5', 'claude')], ['mw', [992, 532, 1074, 650], at('aw5', 'memory')]],
          dot: [[892, 430, 0], [1033, 430, 0.6], [1218, 505, at('aw5', 'claude') + 0.3]] }),
        tag(b, 'Claude Haiku 4.5', at('aw5', 'claude'), ev - at('aw5', 'claude') - 0.1, 'Amazon Bedrock'),
        seg(b, { start: ev, len: +(len - ev).toFixed(2), clip: 'start', from: 3.7, rate: 1.1, cams: [[0, 0, 1.9, 1720, 1250]] }),
        tag(b, 'Haiku picks the party theme', ev + 0.2, len - ev - 0.3),
      ];
    } },
    { vo: 'aw6', fx: [['pop-1', 0.12, 0.3], ['pop-2', 0.97, 0.3], ['pop-1', 1.83, 0.3], ['click', at('aw6', 'ses') + 0.3, 0.4], ['pop-2', at('aw6', 'ses') + 0.55, 0.3]], parts: (b, len) => {
      const s = +(at('aw6', 'amazon') - 0.4).toFixed(2);
      return [
        seg(b, { start: 0, len: s, clip: 'hook', from: 2.3, cams: [[0, 0, 1.0, 1600, 900]] }),
        tag(b, 'Live via AppSync Events', 0.6, s - 0.7),
        seg(b, { start: s, len: +(len - s).toFixed(2), clip: 'invite', from: +(5.06 - (at('aw6', 'ses') + 0.45 - s)).toFixed(2), cams: [[0, 0, 1.8, 1590, 900]] }),
        tag(b, 'Email invites via Amazon SES', s + 0.2, len - s - 0.3),
      ];
    } },
    { vo: 'aw7', pad: 0.9, fx: [['whoosh-3', 0.05, 0.16]], parts: (b, len) => [
      diagram(b, { start: 0, len, views: [[0, [860, 250, 1568, 700], 1.6], [0.1, [100, 760, 1320, 930], 1.6]], hl: [
        ['evb', ops.evb, at('aw7', 'eventbridge')], ['ssm', ops.ssm, at('aw7', 'parameter')], ['iam', ops.iam, at('aw7', 'least')], ['cw', ops.cw, at('aw7', 'cloudwatch')], ['cdk', ops.cdk, at('aw7', 'cdk')]] }),
      tag(b, 'Every 5 minutes', at('aw7', 'eventbridge') + 0.3, 2.6, 'outbox recovery'),
      tag(b, 'Infrastructure as code', at('aw7', 'cdk'), len - at('aw7', 'cdk') - 0.1, 'AWS CDK'),
    ] },
    { vo: 'aw8', pad: 1.4, fx: [['riser', -0.6, 0.45]], parts: (b, len) => [endCard(b, 'AWS', 'Serverless. Event-driven. Ready to scale.', 'celebrate-present', len)] },
  ],
});
