// Writes index.html and compositions/*.html for the Vibe demo film.
// All timings live here so the cut can be retimed in one place. Run: node build.mjs
// Clip coordinates are in recording pixels (3200x1800); the frame shows them at 0.6x (1920x1080).
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const durationOf = (file) => +(+execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', new URL(file, import.meta.url).pathname]).toString()).toFixed(3);

const W = 1920, H = 1080;
const K = 1080 / 1003; // AWS diagram scale to frame height
const DX = (W - 1568 * K) / 2; // diagram left offset
mkdirSync(new URL('./compositions/', import.meta.url), { recursive: true });

// ---------- shared pieces ----------
const fonts = `
@font-face { font-family: 'Geist'; src: url('assets/fonts/geist-400.woff2') format('woff2'); font-weight: 400; }
@font-face { font-family: 'Geist'; src: url('assets/fonts/geist-500.woff2') format('woff2'); font-weight: 500; }
@font-face { font-family: 'Geist'; src: url('assets/fonts/geist-600.woff2') format('woff2'); font-weight: 600; }
@font-face { font-family: 'Geist'; src: url('assets/fonts/geist-700.woff2') format('woff2'); font-weight: 700; }`;

const baseCss = `
#root { position: absolute; inset: 0; overflow: hidden; background: #ffffff; font-family: 'Geist', sans-serif; color: #1f1b27; }
.cam { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; transform-origin: 0 0; }
.cam video, .cam img.still { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; object-fit: cover; display: block; }
.tagwrap { position: absolute; left: 200px; bottom: 132px; z-index: 40; }
.tag { display: flex; align-items: center; gap: 18px; padding: 18px 30px 18px 22px; background: #ffffff; border-radius: 14px;
  box-shadow: 0 12px 30px rgba(31,27,39,.18), 0 0 0 1px rgba(31,27,39,.06); font: 600 38px/1.1 'Geist', sans-serif; color: #1f1b27; white-space: nowrap; }
.tag i { display: block; width: 8px; height: 46px; border-radius: 4px; background: #ec5a44; }
.tag small { font-weight: 500; color: #6b6677; font-size: 30px; }`;

// Camera math, shared by every scene script.
const camJs = `
const F = 0.6;
function camState(s, cx, cy) {
  let x = 960 - cx * F * s, y = 540 - cy * F * s;
  x = Math.min(0, Math.max(${W} - ${W} * s, x));
  y = Math.min(0, Math.max(${H} - ${H} * s, y));
  return { scale: s, x, y };
}
function cam(tl, sel, t, d, s, cx, cy, ease) { tl.to(sel, { ...camState(s, cx, cy), duration: d, ease: ease || 'power3.inOut' }, t); }
function camSet(tl, sel, t, s, cx, cy) { tl.set(sel, camState(s, cx, cy), t); }
function tagIn(tl, sel, t, d) {
  tl.fromTo(sel, { opacity: 0, filter: 'blur(8px)', x: -14 }, { opacity: 1, filter: 'blur(0px)', x: 0, duration: 0.2, ease: 'expo.out' }, t);
  tl.to(sel, { opacity: 0, filter: 'blur(6px)', duration: 0.14, ease: 'power2.in' }, t + d - 0.16);
}`;

/** A recorded segment: wrapper .cam (untimed) holding a timed muted video. */
function seg(scene, key, { start, dur, clip, from, rate = 1, z = 1, extra = '' }) {
  return `<div class="cam" id="${scene}-cam${key}" style="z-index:${z}"><video id="${scene}-v${key}" class="clip" src="assets/clips/${clip}.mp4" muted playsinline data-start="${start}" data-duration="${dur}" data-media-start="${from}" data-playback-rate="${rate}" data-track-index="1"></video>${extra}</div>`;
}
function tag(scene, key, text, start, dur, sub = '', pos = null) {
  const place = pos ? ` style="left:${pos.left}px;top:${pos.top}px;bottom:auto"` : '';
  return {
    html: `<div class="clip tagwrap" id="${scene}-tag${key}" data-start="${start}" data-duration="${dur}" data-track-index="5"${place}><div class="tag" id="${scene}-tag${key}i"><i></i><span>${text}${sub ? ` <small>${sub}</small>` : ''}</span></div></div>`,
    js: `tagIn(tl, '#${scene}-tag${key}i', ${start}, ${dur});`,
  };
}

function scene(id, duration, { css = '', html, js }) {
  const file = `<template>
  <style>${fonts}${baseCss}${css}</style>
  <div id="root" data-composition-id="${id}" data-width="${W}" data-height="${H}" data-duration="${duration}">
${html}
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
${camJs}
${js}
    window.__timelines["${id}"] = tl;
  </script>
</template>
`;
  writeFileSync(new URL(`./compositions/${id}.html`, import.meta.url), file);
}

const scenes = [];
const sfx = [];
const add = (id, start, duration) => scenes.push({ id, start, duration });
const hit = (name, t, volume) => sfx.push({ name, t: Math.max(0, +t.toFixed(3)), volume });

// ---------- 1. Hook: four friends talking over each other ----------
{
  const S = 0;
  add('hook', S, 6.4);
  scene('hook', 6.4, {
    html: seg('hook', 'A', { start: 0, dur: 6.4, clip: 'hook', from: 2.2 }),
    js: `
camSet(tl, '#hook-camA', 0, 1.0, 1600, 900);
cam(tl, '#hook-camA', 1.95, 0.55, 1.45, 2390, 760);
cam(tl, '#hook-camA', 3.9, 0.6, 1.0, 1600, 900);
tl.to('#hook-camA', { x: -520, duration: 0.22, ease: 'power3.in' }, 6.18);`,
  });
  [0.22, 1.07, 1.93, 2.78, 3.63].forEach((t, i) => hit(i % 2 ? 'pop-2' : 'pop-1', S + t, 0.32));
  hit('whoosh-3', S + 6.2, 0.5);
}

// ---------- 2. Start a party: Vibe picks the theme ----------
{
  const S = 6.4;
  add('start', S, 8.0);
  const t1 = tag('start', '1', 'Claude Haiku picks the theme', 2.7, 2.75);
  scene('start', 8.0, {
    html: seg('start', 'A', { start: 0, dur: 8.0, clip: 'start', from: 1.0, rate: 1.25 }) + t1.html,
    js: `
camSet(tl, '#start-camA', 0, 1.0, 1600, 900);
tl.fromTo('#start-camA', { x: 520 }, { x: 0, duration: 0.3, ease: 'expo.out' }, 0);
cam(tl, '#start-camA', 0.35, 0.5, 1.35, 1860, 1050);
cam(tl, '#start-camA', 1.15, 0.5, 1.55, 1600, 920);
cam(tl, '#start-camA', 2.55, 0.45, 1.9, 1720, 1250);
// Pull back as the party is created so the Studies backdrop is seen arriving under the callout.
cam(tl, '#start-camA', 4.25, 0.55, 1.0, 1600, 900);
cam(tl, '#start-camA', 6.3, 0.55, 1.75, 2600, 1300);
${t1.js}`,
  });
  hit('click', S + 0.82, 0.4);
  hit('click', S + 2.3, 0.4);
  hit('click', S + 5.24, 0.4);
  hit('sparkle', S + 5.65, 0.4);
}

// ---------- 3. Class search: four questions, four sources ----------
{
  const S = 14.4;
  add('class', S, 16.6);
  const tags = [
    tag('class', '1', 'ASU class catalog', 3.9, 2.0, 'live sections'),
    tag('class', '2', 'Course syllabus', 6.05, 1.3),
    tag('class', '3', 'Rate My Professors', 7.45, 1.3),
    tag('class', '4', 'Everyone’s schedules', 9.4, 3.7),
    tag('class', '5', 'Every answer cites its sources', 13.5, 3.0),
  ];
  scene('class', 16.6, {
    html: [
      seg('class', 'A', { start: 0, dur: 3.0, clip: 'class', from: 3.4, rate: 1.5, z: 1 }),
      seg('class', 'B', { start: 3.0, dur: 3.0, clip: 'class', from: 13.5, rate: 1.4, z: 2 }),
      seg('class', 'C', { start: 6.0, dur: 1.4, clip: 'class', from: 25.45, z: 3 }),
      seg('class', 'D', { start: 7.4, dur: 1.4, clip: 'class', from: 34.05, z: 4 }),
      seg('class', 'E', { start: 8.8, dur: 4.4, clip: 'class', from: 46.5, z: 5 }),
      seg('class', 'F', { start: 13.2, dur: 3.4, clip: 'class', from: 52.3, z: 6 }),
      ...tags.map((t) => t.html),
    ].join('\n'),
    js: `
camSet(tl, '#class-camA', 0, 1.55, 1300, 1430);
cam(tl, '#class-camA', 2.45, 0.5, 1.0, 1600, 900);
camSet(tl, '#class-camB', 0, 1.0, 1600, 900);
cam(tl, '#class-camB', 3.6, 0.55, 1.35, 1560, 860);
camSet(tl, '#class-camC', 0, 1.7, 1425, 1030);
camSet(tl, '#class-camD', 0, 1.7, 1400, 1060);
camSet(tl, '#class-camE', 0, 1.0, 1600, 900);
cam(tl, '#class-camE', 9.35, 0.55, 1.4, 1620, 1000);
camSet(tl, '#class-camF', 0, 1.4, 1620, 1000);
cam(tl, '#class-camF', 13.3, 0.5, 1.9, 1250, 1230);
${tags.map((t) => t.js).join('\n')}`,
  });
  hit('keys', S + 0.15, 0.28);
  hit('click', S + 2.78, 0.4);
  hit('pop-1', S + 3.51, 0.35);
  hit('confetti', S + 5.29, 0.4);
  hit('whoosh-2', S + 5.95, 0.16);
  hit('pop-2', S + 9.25, 0.35);
  hit('confetti', S + 11.1, 0.4);
  hit('click', S + 13.68, 0.4);
}

// ---------- 4. Teamwork: notes, tasks, invites ----------
{
  const S = 31.0;
  add('team', S, 8.4);
  const tags = [
    tag('team', '1', 'Decisions saved as party notes', 0.8, 1.7),
    tag('team', '2', 'Tasks need the assignee’s yes', 2.65, 1.7),
    tag('team', '3', 'Invite by link, QR or email', 5.9, 2.0, '', { left: 1300, top: 190 }),
  ];
  scene('team', 8.4, {
    css: `#team-flood { position: absolute; inset: 0; background: #e8f5e6; z-index: 60; clip-path: circle(0px at 78px 248px); }`,
    html: [
      seg('team', 'A', { start: 0, dur: 4.4, clip: 'class', from: 55.6, rate: 1.5, z: 1 }),
      // The clone's mock served the trip party's invite path here; the patch shows this party's link instead.
      seg('team', 'B', { start: 4.4, dur: 4.0, clip: 'class', from: 64.4, z: 2, extra: `<div id="team-linkfix" style="position:absolute;left:${1204 * 0.6}px;top:${1238 * 0.6}px;width:${590 * 0.6}px;height:${62 * 0.6}px;background:#fff;display:flex;align-items:center;padding-left:${14 * 0.6}px;font:400 ${30 * 0.6}px 'Geist',sans-serif;color:#1f1b27;white-space:nowrap;opacity:0">https://vibe-chat.us/invite/cse-511-q8m2</div>` }),
      ...tags.map((t) => t.html),
      `<div id="team-floodwrap" class="clip" data-start="7.9" data-duration="0.5" data-track-index="6" data-layout-ignore><div id="team-flood"></div></div>`,
    ].join('\n'),
    js: `
camSet(tl, '#team-camA', 0, 1.0, 1600, 900);
cam(tl, '#team-camA', 0.45, 0.5, 1.75, 2860, 480);
cam(tl, '#team-camA', 2.55, 0.45, 1.9, 2860, 420);
camSet(tl, '#team-camB', 0, 1.0, 1600, 900);
cam(tl, '#team-camB', 5.75, 0.5, 1.5, 1600, 880);
tl.set('#team-linkfix', { opacity: 1 }, 7.0);
${tags.map((t) => t.js).join('\n')}
tl.fromTo('#team-flood', { clipPath: 'circle(0px at 78px 248px)' }, { clipPath: 'circle(2300px at 78px 248px)', duration: 0.42, ease: 'power2.inOut' }, 7.95);`,
  });
  hit('whoosh-2', S + 0.2, 0.25);
  hit('click', S + 3.82, 0.4);
  hit('click', S + 5.43, 0.4);
  hit('click', S + 6.51, 0.4);
  hit('pop-1', S + 7.1, 0.3);
  hit('whoosh-1', S + 7.9, 0.35);
}

// ---------- 5. Day trip: weather + plan that remembers ----------
{
  const S = 39.4;
  add('trip', S, 9.2);
  const tags = [
    tag('trip', '1', 'Live web search', 3.85, 2.35, 'weather.gov'),
    tag('trip', '2', 'From Maya’s approved memory', 7.45, 1.75),
  ];
  // Marker over "Maya's vegetarian" in the itinerary, drawn inside the camera so it moves with the shot.
  const marker = `<div id="trip-mark" style="position:absolute;left:${1316 * 0.6}px;top:${970 * 0.6}px;width:${272 * 0.6}px;height:${44 * 0.6}px;background:rgba(236,90,68,.22);border-bottom:3px solid #ec5a44;border-radius:4px;transform-origin:0 50%;transform:scaleX(0)"></div>`;
  scene('trip', 9.2, {
    css: `#trip-flood { position: absolute; inset: 0; background: #e8f5e6; z-index: 60; }`,
    html: [
      seg('trip', 'A', { start: 0, dur: 3.6, clip: 'trip', from: 1.2, z: 1 }),
      seg('trip', 'B', { start: 3.6, dur: 1.9, clip: 'trip', from: 8.45, z: 2 }),
      seg('trip', 'C', { start: 5.5, dur: 3.7, clip: 'trip', from: 33.3, z: 3, extra: marker }),
      ...tags.map((t) => t.html),
      `<div id="trip-floodwrap" class="clip" data-start="0" data-duration="0.5" data-track-index="6" data-layout-ignore><div id="trip-flood"></div></div>`,
    ].join('\n'),
    js: `
tl.fromTo('#trip-flood', { opacity: 1 }, { opacity: 0, duration: 0.35, ease: 'power2.out' }, 0.05);
camSet(tl, '#trip-camA', 0, 1.06, 1600, 900);
cam(tl, '#trip-camA', 0.05, 0.6, 1.0, 1600, 900, 'expo.out');
cam(tl, '#trip-camA', 1.4, 0.5, 1.4, 1400, 800);
camSet(tl, '#trip-camB', 0, 1.4, 1400, 800);
cam(tl, '#trip-camB', 3.75, 0.5, 1.6, 1520, 980);
camSet(tl, '#trip-camC', 0, 1.35, 1550, 850);
cam(tl, '#trip-camC', 7.75, 0.55, 2.1, 1530, 995);
tl.fromTo('#trip-mark', { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: 'power2.out' }, 8.0);
${tags.map((t) => t.js).join('\n')}`,
  });
  hit('pop-2', S + 1.52, 0.32);
  hit('pop-1', S + 3.78, 0.35);
  hit('pop-2', S + 5.73, 0.32);
  hit('confetti', S + 7.58, 0.4);
  hit('sparkle', S + 8.0, 0.4);
}

// ---------- 6. AWS: the message travels through the architecture ----------
{
  const S = 48.6;
  add('aws', S, 25.6);
  const fr = ([x0, y0, x1, y1]) => [DX + x0 * K, y0 * K, DX + x1 * K, y1 * K];
  const view = (rect, max = 1.85) => {
    const [x0, y0, x1, y1] = fr(rect);
    const s = Math.min(max, Math.min(W / (x1 - x0), H / (y1 - y0)) * 0.9);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    let x = W / 2 - cx * s, y = H / 2 - cy * s;
    x = Math.min(0, Math.max(W - W * s, x)); y = Math.min(0, Math.max(H - H * s, y));
    return `{scale:${s.toFixed(3)},x:${x.toFixed(1)},y:${y.toFixed(1)}}`;
  };
  const hl = [ // [id, rect in diagram px, in, out]
    ['cf', [196, 258, 410, 392], 1.8, 5.5],
    ['cog', [300, 418, 392, 530], 4.15, 5.5],
    ['apigw', [288, 540, 384, 662], 5.8, 9.9],
    ['lam', [444, 466, 532, 598], 6.85, 9.9],
    ['ddb', [548, 462, 636, 646], 8.6, 9.9],
    ['disp', [696, 462, 784, 600], 10.0, 19.2],
    ['sqs', [850, 372, 936, 508], 12.3, 19.2],
    ['work', [992, 372, 1074, 502], 13.4, 19.2],
    ['bed', [1170, 444, 1268, 594], 14.5, 19.2],
    ['res', [1166, 238, 1306, 348], 17.8, 19.2],
    ['ext', [1384, 206, 1552, 466], 18.0, 19.2],
    ['sync', [530, 662, 620, 786], 19.4, 22.1],
    ['evb', [1086, 822, 1304, 902], 22.3, 23.8],
    ['sm', [1386, 504, 1554, 606], 23.7, 25.6],
  ];
  const rects = hl.map(([id, [x0, y0, x1, y1]]) => `<rect id="aws-h-${id}" x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" rx="12" pathLength="1" fill="rgba(236,90,68,.08)" stroke="#ec5a44" stroke-width="4" stroke-dasharray="1" stroke-dashoffset="1" opacity="0" />`).join('');
  // The message's path, in diagram px: [x, y, arrival time]
  const path = [
    [80, 418, 0.0], [124, 592, 5.9], [335, 592, 6.5], [488, 520, 7.1], [590, 520, 8.7],
    [740, 520, 10.3], [892, 430, 12.5], [1033, 430, 13.5], [1218, 505, 14.7],
    [1468, 421, 17.9], [1033, 430, 19.45], [745, 690, 20.0], [575, 712, 20.5], [125, 712, 21.2], [48, 590, 21.6],
  ];
  const dotJs = path.slice(1).map(([x, y, t], i) => {
    const prevT = path[i][2];
    const start = i === 0 ? 5.4 : Math.max(prevT, t - 0.55);
    return `tl.to('#aws-dot', { attr: { cx: ${x}, cy: ${y} }, duration: ${(t - start).toFixed(2)}, ease: 'power2.inOut' }, ${start.toFixed(2)});`;
  }).join('\n');
  const laptop = [DX + 46 * K, 418 * K];
  const smCenter = [DX + 1470 * K, 555 * K];
  scene('aws', 25.6, {
    css: `
#aws-ground { position: absolute; inset: 0; background: #ffffff; }
#aws-stage { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; transform-origin: 0 0; }
#aws-img { position: absolute; left: ${DX}px; top: 0; width: ${1568 * K}px; height: ${H}px; }
#aws-svg { position: absolute; left: ${DX}px; top: 0; width: ${1568 * K}px; height: ${H}px; overflow: visible; }
#aws-trip { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; transform-origin: 0 0; z-index: 10; border-radius: 0; }
#aws-trip img { width: 100%; height: 100%; object-fit: cover; display: block; }
#aws-pip { position: absolute; left: 0; top: 0; width: 210px; z-index: 12; }
#aws-white { position: absolute; inset: 0; background: #ffffff; z-index: 20; opacity: 0; }`,
    html: `
<div id="aws-ground"></div>
<div id="aws-stage" data-layout-allow-overflow>
  <img id="aws-img" src="assets/stills/aws-architecture.png" alt="Vibe AWS architecture" />
  <svg id="aws-svg" viewBox="0 0 1568 1003">${rects}<circle id="aws-dot" cx="${path[0][0]}" cy="${path[0][1]}" r="11" fill="#ec5a44" stroke="#fff" stroke-width="4" opacity="0" /></svg>
  <img id="aws-pip" src="assets/pip/build-zoom.png" alt="" />
</div>
<div id="aws-tripwrap" class="clip" data-start="0" data-duration="1.4" data-track-index="2"><div id="aws-trip"><img src="assets/stills/trip-end.png" alt="" /></div></div>
<div id="aws-whitewrap" class="clip" data-start="24.5" data-duration="1.1" data-track-index="3"><div id="aws-white"></div></div>`,
    js: `
// Carry: the trip chat shrinks onto the diagram's laptop while the diagram arrives.
tl.set('#aws-stage', { scale: 1, x: 0, y: 0 }, 0);
tl.fromTo('#aws-stage', { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 0.25);
tl.fromTo('#aws-trip', { scale: 1, x: 0, y: 0, opacity: 1 }, { scale: 0.03, x: ${(laptop[0] - 0.015 * W).toFixed(1)}, y: ${(laptop[1] - 0.015 * H).toFixed(1)}, duration: 0.95, ease: 'power3.inOut' }, 0.05);
tl.to('#aws-trip', { opacity: 0, duration: 0.25 }, 1.05);
tl.to('#aws-dot', { opacity: 1, duration: 0.2 }, 1.1);
// Camera across the diagram, following the narration.
tl.to('#aws-stage', { ...${view([120, 220, 420, 560])}, duration: 0.6, ease: 'power3.inOut' }, 1.55);
tl.to('#aws-stage', { ...${view([270, 430, 800, 690])}, duration: 0.6, ease: 'power3.inOut' }, 5.45);
tl.to('#aws-stage', { ...${view([680, 200, 1560, 640], 1.6)}, duration: 0.65, ease: 'power3.inOut' }, 9.8);
tl.to('#aws-stage', { ...${view([20, 430, 820, 800])}, duration: 0.6, ease: 'power3.inOut' }, 19.2);
tl.to('#aws-stage', { ...${view([840, 640, 1560, 920])}, duration: 0.6, ease: 'power3.inOut' }, 21.95);
tl.to('#aws-stage', { ...${view([1250, 420, 1568, 700], 2.2)}, duration: 0.6, ease: 'power3.inOut' }, 23.55);
// Zoom through the Supermemory box into the next scene.
tl.to('#aws-stage', { scale: 9, x: ${(W / 2 - smCenter[0] * 9).toFixed(1)}, y: ${(H / 2 - smCenter[1] * 9).toFixed(1)}, duration: 0.75, ease: 'power3.in' }, 24.6);
tl.fromTo('#aws-white', { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power2.in' }, 25.0);
${hl.map(([id, , tin, tout]) => `tl.fromTo('#aws-h-${id}', { opacity: 0, attr: { 'stroke-dashoffset': 1 } }, { opacity: 1, attr: { 'stroke-dashoffset': 0 }, duration: 0.45, ease: 'power2.out' }, ${tin});
tl.to('#aws-h-${id}', { opacity: 0, duration: 0.25 }, ${tout});`).join('\n')}
${dotJs}
tl.to('#aws-dot', { opacity: 0, duration: 0.2 }, 21.8);
// Pip flies in from the right and lands beside the Supermemory box.
tl.fromTo('#aws-pip', { x: ${DX + 1700 * K}, y: ${300 * K}, rotation: -18, opacity: 1 }, { x: ${DX + 1110 * K}, y: ${615 * K}, rotation: 0, duration: 0.7, ease: 'back.out(1.6)' }, 23.75);
tl.set('#aws-pip', { opacity: 0 }, 0);
tl.set('#aws-pip', { opacity: 1 }, 23.75);`,
  });
  hit('whoosh-1', S + 0.05, 0.3);
  hit('whoosh-2', S + 1.5, 0.14);
  hit('whoosh-3', S + 5.4, 0.16);
  hit('whoosh-1', S + 9.75, 0.14);
  hit('sparkle', S + 14.5, 0.3);
  hit('whoosh-2', S + 19.15, 0.14);
  hit('whoosh-3', S + 23.6, 0.35);
  hit('whoosh-1', S + 24.55, 0.45);
}

// ---------- 7. Supermemory: how Vibe knew ----------
{
  const S = 74.2;
  add('memory', S, 19.4);
  const tags = [
    tag('memory', '1', 'Learned without a tag', 3.0, 3.2, 'private until approved', { left: 900, top: 470 }),
    tag('memory', '2', 'Maya approves it', 11.6, 2.2, '', { left: 900, top: 470 }),
    tag('memory', '3', 'Opt in per party', 14.3, 2.05, '', { left: 1130, top: 600 }),
    tag('memory', '4', 'Edit or delete any time', 16.7, 2.6, '', { left: 900, top: 470 }),
  ];
  const ring = `<div id="memory-ring" style="position:absolute;left:${1856 * 0.6}px;top:${716 * 0.6}px;width:${1148 * 0.6}px;height:${110 * 0.6}px;border:3px solid #ec5a44;border-radius:16px;box-shadow:0 0 0 6px rgba(236,90,68,.15);opacity:0"></div>`;
  scene('memory', 19.4, {
    css: `
#memory-start { position: absolute; inset: 0; background: #fff; z-index: 30; }
#memory-world { position: absolute; inset: 0; background: #f6f6f8; }
.mw-card { position: absolute; background: #fff; border-radius: 22px; box-shadow: 0 10px 30px rgba(31,27,39,.10), 0 0 0 1px rgba(31,27,39,.06); }
.mw-head { display: flex; align-items: center; gap: 16px; padding: 26px 30px 0; font: 600 34px 'Geist'; }
.mw-sw { width: 46px; height: 46px; border-radius: 12px; display: grid; place-items: center; }
.mw-cap { position: absolute; font: 500 28px 'Geist'; color: #6b6677; }
.mw-bubble { position: absolute; left: 30px; right: 30px; padding: 18px 22px; border-radius: 18px; font: 400 29px/1.3 'Geist'; }
.mw-slot { position: absolute; left: 30px; right: 30px; border: 2px dashed #d6d3dd; border-radius: 18px; }
.mw-slot b { position: absolute; left: 22px; top: 18px; font: 600 30px 'Geist'; }
.mw-slot span { position: absolute; left: 22px; top: 60px; font: 400 28px 'Geist'; color: #5d5868; }
#memory-token { position: absolute; left: 0; top: 0; padding: 16px 26px; background: #fff; border-radius: 14px; font: 600 32px 'Geist'; box-shadow: 0 12px 26px rgba(31,27,39,.18); display: flex; gap: 14px; align-items: center; }
#memory-token i { width: 14px; height: 14px; border-radius: 50%; background: #ec5a44; }`,
    html: [
      `<div class="cam" id="memory-camS" style="z-index:1"><img class="still clip" id="memory-still" src="assets/stills/hook-chat.png" alt="" data-start="0" data-duration="2.8" data-track-index="1" />${ring}</div>`,
      seg('memory', 'A', { start: 2.6, dur: 3.8, clip: 'memory', from: 3.92, rate: 0.1, z: 2, extra: `<div id="memory-ringA" style="position:absolute;left:${1092 * 0.6}px;top:${812 * 0.6}px;width:${1560 * 0.6}px;height:${250 * 0.6}px;border:3px solid #ec5a44;border-radius:14px;box-shadow:0 0 0 6px rgba(236,90,68,.15);opacity:0"></div>` }),
      `<div id="memory-worldwrap" class="clip" data-start="6.4" data-duration="4.8" data-track-index="2" style="position:absolute;inset:0;z-index:3"><div id="memory-world">
  <div class="mw-card" id="mw-class" style="left:190px;top:160px;width:640px;height:330px">
    <div class="mw-head"><span class="mw-sw" style="background:hsl(268 80% 94%);color:hsl(268 45% 45%)">📘</span>Classes next semester</div>
    <div class="mw-bubble" style="top:120px;background:hsl(220 90% 94%)">anything but 8ams 😭 also I’m vegetarian … lol</div>
  </div>
  <div class="mw-cap" id="mw-cap1" style="left:190px;top:506px">Party space · only this chat</div>
  <div class="mw-card" id="mw-trip" style="left:190px;top:600px;width:640px;height:290px">
    <div class="mw-head"><span class="mw-sw" style="background:hsl(150 60% 90%);color:hsl(150 45% 32%)">⛰️</span>Saturday day trip</div>
    <div class="mw-bubble" style="top:120px;background:#f3f2f6;color:#6b6677">Vibe plans the day here</div>
  </div>
  <div class="mw-cap" id="mw-cap2" style="left:190px;top:906px">Party space · only this chat</div>
  <div class="mw-card" id="mw-mem" style="left:1090px;top:160px;width:640px;height:730px">
    <div class="mw-head"><span class="mw-sw" style="background:#fde8e4;color:#ec5a44">✦</span>Maya’s memory</div>
    <div class="mw-slot" id="mw-private" style="top:120px;height:270px"><b>Private</b><span>Needs Maya’s review</span></div>
    <div class="mw-slot" id="mw-approved" style="top:420px;height:270px"><b>Approved</b><span>Used only where she opts in</span></div>
  </div>
  <div class="mw-cap" id="mw-cap3" style="left:1090px;top:906px">Powered by Supermemory</div>
  <svg id="mw-lockline" style="position:absolute;left:0;top:0;width:1920px;height:1080px;overflow:visible" viewBox="0 0 1920 1080">
    <path id="mw-path" d="M1090 690 C 990 700, 930 740, 830 745" fill="none" stroke="#ec5a44" stroke-width="5" stroke-dasharray="14 12" opacity="0" />
    <g id="mw-lock" opacity="0" transform="translate(938 690)"><rect x="-30" y="-6" width="60" height="48" rx="10" fill="#ec5a44"/><path d="M-17 -6 v-12 a17 17 0 0 1 34 0 v12" fill="none" stroke="#ec5a44" stroke-width="7"/><circle cx="0" cy="16" r="6" fill="#fff"/></g>
  </svg>
  <div id="memory-token"><i></i>Vegetarian</div>
</div></div>`,
      seg('memory', 'B', { start: 11.2, dur: 2.7, clip: 'memory', from: 3.6, rate: 0.33, z: 4, extra: `<div id="memory-ringB" style="position:absolute;left:${1092 * 0.6}px;top:${812 * 0.6}px;width:${1560 * 0.6}px;height:${250 * 0.6}px;border:3px solid #ec5a44;border-radius:14px;box-shadow:0 0 0 6px rgba(236,90,68,.15);opacity:0"></div>` }),
      seg('memory', 'C', { start: 13.9, dur: 2.5, clip: 'memory', from: 10.4, z: 5, extra: `<div id="memory-ringC" style="position:absolute;left:${3050 * 0.6}px;top:${368 * 0.6}px;width:${140 * 0.6}px;height:${64 * 0.6}px;border:3px solid #ec5a44;border-radius:14px;box-shadow:0 0 0 6px rgba(236,90,68,.15);opacity:0"></div>` }),
      seg('memory', 'D', { start: 16.4, dur: 3.0, clip: 'memory', from: 5.0, rate: 0.4, z: 6, extra: `<div id="memory-ringD" style="position:absolute;left:${1098 * 0.6}px;top:${986 * 0.6}px;width:${400 * 0.6}px;height:${64 * 0.6}px;border:3px solid #ec5a44;border-radius:14px;box-shadow:0 0 0 6px rgba(236,90,68,.15);opacity:0"></div>` }),
      ...tags.map((t) => t.html),
      `<div id="memory-startwrap" class="clip" data-start="0" data-duration="0.5" data-track-index="6" data-layout-ignore><div id="memory-start"></div></div>`,
    ].join('\n'),
    js: `
tl.fromTo('#memory-start', { opacity: 1 }, { opacity: 0, duration: 0.35, ease: 'power2.out' }, 0.05);
camSet(tl, '#memory-camS', 0, 2.3, 2430, 771);
cam(tl, '#memory-camS', 0.1, 1.2, 1.85, 2430, 771, 'expo.out');
tl.fromTo('#memory-ring', { opacity: 0, scale: 1.08 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'expo.out' }, 0.5);
camSet(tl, '#memory-camA', 0, 2.0, 1868, 930);
tl.fromTo('#memory-ringA', { opacity: 0, scale: 1.04 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'expo.out' }, 2.9);
tl.fromTo('#memory-camA', { opacity: 0 }, { opacity: 1, duration: 0.2 }, 2.6);
// Spaces graphic.
tl.fromTo('#memory-world', { opacity: 0, filter: 'blur(8px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.22, ease: 'expo.out' }, 6.4);
['#mw-class', '#mw-trip', '#mw-mem'].forEach((sel, i) => tl.fromTo(sel, { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'expo.out' }, 6.45 + i * 0.08));
['#mw-cap1', '#mw-cap2', '#mw-cap3'].forEach((sel, i) => tl.fromTo(sel, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 6.9 + i * 0.12));
tl.fromTo('#memory-token', { x: 500, y: 300, scale: 0.6, opacity: 0 }, { x: 500, y: 300, scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.8)' }, 7.25);
tl.to('#memory-token', { x: 1150, y: 470, duration: 0.8, ease: 'power2.inOut' }, 7.65);
tl.fromTo('#mw-private', { borderColor: '#d6d3dd' }, { borderColor: '#ec5a44', duration: 0.3 }, 8.35);
tl.fromTo('#mw-path', { opacity: 0, strokeDashoffset: 120 }, { opacity: 1, strokeDashoffset: 0, duration: 0.5, ease: 'power2.out' }, 9.4);
tl.fromTo('#mw-lock', { opacity: 0, scale: 0.6, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2)' }, 9.75);
camSet(tl, '#memory-camB', 0, 2.0, 1868, 930);
tl.set('#memory-ringB', { opacity: 1 }, 11.2);
camSet(tl, '#memory-camC', 0, 2.0, 2860, 430);
tl.fromTo('#memory-ringC', { opacity: 0, scale: 1.2 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'expo.out' }, 14.2);
camSet(tl, '#memory-camD', 0, 2.0, 1868, 930);
tl.fromTo('#memory-ringD', { opacity: 0, scale: 1.08 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'expo.out' }, 16.7);
${tags.map((t) => t.js).join('\n')}`,
  });
  hit('sparkle', S + 0.5, 0.35);
  hit('whoosh-2', S + 2.55, 0.2);
  hit('pop-1', S + 7.25, 0.35);
  hit('whoosh-1', S + 7.65, 0.18);
  hit('pop-2', S + 8.4, 0.32);
  hit('click', S + 9.75, 0.3);
  hit('click', S + 13.38, 0.4);
  hit('click', S + 15.16, 0.4);
}

// ---------- 8. Pip ----------
{
  const S = 93.2;
  add('pip', S, 16.2);
  scene('pip', 16.2, {
    css: `
#pip-irisbox { position: absolute; inset: 0; z-index: 1; }
.pip-col { position: absolute; top: 0; height: ${H}px; background: #ffffff; z-index: 8; }
#pip-white { position: absolute; inset: 0; background: #ffffff; z-index: 20; opacity: 0; }`,
    html: [
      `<div id="pip-irisbox">${seg('pip', 'A', { start: 0, dur: 2.0, clip: 'pip-solo', from: 0.1, z: 1 })}</div>`,
      seg('pip', 'B', { start: 2.0, dur: 2.2, clip: 'pip', from: 3.6, z: 2 }),
      seg('pip', 'C', { start: 4.2, dur: 2.0, clip: 'pip', from: 8.9, z: 3 }),
      seg('pip', 'D', { start: 6.2, dur: 2.2, clip: 'trip', from: 34.3, z: 4 }),
      seg('pip', 'E', { start: 8.4, dur: 2.4, clip: 'pip', from: 15.6, rate: 1.33, z: 5 }),
      seg('pip', 'F', { start: 10.8, dur: 2.2, clip: 'pip', from: 26.6, rate: 2.0, z: 6 }),
      seg('pip', 'G', { start: 13.0, dur: 3.2, clip: 'pip-outfits', from: 0.2, z: 7 }),
      `<div id="pip-cols" class="clip" data-start="13.0" data-duration="0.8" data-track-index="6" data-layout-ignore>${Array.from({ length: 7 }, (_, i) => `<div class="pip-col" id="pip-col${i}" style="left:${(i * W) / 7}px;width:${W / 7 + 1}px"></div>`).join('')}</div>`,
      `<div id="pip-whitewrap" class="clip" data-start="15.7" data-duration="0.5" data-track-index="7" data-layout-ignore><div id="pip-white"></div></div>`,
    ].join('\n'),
    js: `
tl.fromTo('#pip-irisbox', { clipPath: 'circle(0px at 960px 560px)' }, { clipPath: 'circle(1200px at 960px 560px)', duration: 0.42, ease: 'power2.inOut' }, 0);
camSet(tl, '#pip-camA', 0, 1.0, 1600, 900);
camSet(tl, '#pip-camB', 0, 1.6, 1250, 1450);
camSet(tl, '#pip-camC', 0, 1.5, 1900, 1050);
camSet(tl, '#pip-camD', 0, 1.3, 1650, 820);
camSet(tl, '#pip-camE', 0, 1.3, 2050, 900);
camSet(tl, '#pip-camF', 0, 1.6, 2030, 960);
camSet(tl, '#pip-camG', 0, 1.0, 1600, 900);
${Array.from({ length: 7 }, (_, i) => `tl.fromTo('#pip-col${i}', { yPercent: 0 }, { yPercent: -101, duration: 0.42, ease: 'power3.inOut' }, ${(13.0 + i * 0.06).toFixed(2)});`).join('\n')}
tl.fromTo('#pip-white', { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.inOut' }, 15.75);`,
  });
  hit('whoosh-2', S + 0.0, 0.25);
  hit('keys', S + 2.0, 0.26);
  hit('pop-1', S + 4.38, 0.32);
  hit('confetti', S + 7.28, 0.4);
  hit('squeak', S + 8.48, 0.3);
  hit('boing', S + 9.67, 0.5);
  hit('snore', S + 10.75, 0.45);
  hit('squeak', S + 12.36, 0.3);
  hit('sparkle', S + 13.05, 0.4);
  hit('whoosh-1', S + 15.7, 0.25);
}

// ---------- 9. End card ----------
{
  const S = 109.4;
  add('end', S, 7.1);
  const mark = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><path d="M1.3 5.1Q12 8.9 22.7 5.1" fill="none" stroke="#3b3646" stroke-width="1.3" stroke-linecap="round"/><path d="M2.5 5.6Q4.5 6.2 6.5 6.6L5.05 11.9Q4.5 13.1 3.95 11.9Z" fill="#f2b33d"/><path d="M17.5 6.6Q19.5 6.2 21.5 5.6L20.05 11.9Q19.5 13.1 18.95 11.9Z" fill="#2fb3b8"/><path d="M7.3 6.75Q12 7.95 16.7 6.75L12.9 19.7Q12 21.3 11.1 19.7Z" fill="#ec5a44"/></svg>`;
  scene('end', 7.1, {
    css: `
#end-lock { position: absolute; left: 0; top: 0; width: ${W}px; display: flex; justify-content: center; align-items: center; gap: 28px; top: 250px; }
#end-mark { width: 230px; height: 230px; }
#end-word { font: 700 190px/1 'Geist'; letter-spacing: -0.04em; color: #1f1b27; clip-path: inset(0 100% 0 0); }
#end-tagline { position: absolute; left: 0; width: ${W}px; top: 560px; text-align: center; font: 600 60px 'Geist'; letter-spacing: -0.02em; }
#end-tagline span { display: inline-block; margin: 0 8px; }
#end-url { position: absolute; left: 50%; top: 680px; transform: translateX(-50%); padding: 20px 44px; border-radius: 18px; background: #ec5a44; color: #fff; font: 600 52px 'Geist'; }
#end-credit { position: absolute; left: 0; width: ${W}px; top: 860px; text-align: center; font: 500 34px 'Geist'; color: #3b3646; }
#end-note { position: absolute; left: 0; width: ${W}px; top: 912px; text-align: center; font: 400 28px 'Geist'; color: #8a8594; }
#end-pip { position: absolute; left: 0; top: 0; width: 340px; }`,
    html: `
<div id="end-lockwrap" class="clip" data-start="0" data-duration="7.1" data-track-index="1"><div id="end-lock"><div id="end-mark">${mark(230)}</div><div id="end-word">vibe</div></div></div>
<div id="end-tagwrap" class="clip" data-start="1.45" data-duration="5.65" data-track-index="2"><div id="end-tagline"><span>Your</span><span>group’s</span><span>AI</span><span>teammate</span></div></div>
<div id="end-urlwrap" class="clip" data-start="3.35" data-duration="3.75" data-track-index="3"><div id="end-url">vibe-chat.us</div></div>
<div id="end-creditwrap" class="clip" data-start="4.3" data-duration="2.8" data-track-index="4"><div id="end-credit">Built by Anish &amp; Bhavesh · SunHacks 2026</div><div id="end-note">Demo conversations use sample data.</div></div>
<div id="end-pipwrap" class="clip" data-start="0" data-duration="7.1" data-track-index="5"><img id="end-pip" src="assets/pip/celebrate-present.png" alt="" /></div>`,
    js: `
// Pip flies in carrying the mark; the mark lands in the lockup with the riser's hit.
tl.fromTo('#end-pip', { x: 2000, y: 640, rotation: 16 }, { x: 1290, y: 140, rotation: 0, duration: 0.8, ease: 'power2.out' }, 0.0);
tl.fromTo('#end-mark', { x: 640, y: -60, scale: 0.55, rotation: -12 }, { x: 0, y: 0, scale: 1, rotation: 0, duration: 0.55, ease: 'back.out(1.5)' }, 0.32);
tl.fromTo('#end-word', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.45, ease: 'power3.out' }, 0.9);
tl.to('#end-pip', { x: 1450, y: 520, rotation: -8, duration: 0.7, ease: 'back.out(1.4)' }, 1.0);
['1','2','3','4'].forEach(() => {});
${[0, 1, 2, 3].map((i) => `tl.fromTo('#end-tagline span:nth-child(${i + 1})', { opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.14, ease: 'power2.out' }, ${(1.5 + i * 0.09).toFixed(2)});`).join('\n')}
tl.fromTo('#end-url', { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.8)' }, 3.4);
tl.fromTo('#end-credit', { opacity: 0 }, { opacity: 1, duration: 0.35 }, 4.35);
tl.fromTo('#end-note', { opacity: 0 }, { opacity: 1, duration: 0.35 }, 4.55);`,
  });
  hit('riser', S + 0.87 - 1.18, 0.5);
  hit('pop-1', S + 3.42, 0.3);
}

// ---------- root ----------
const total = 116.5;
const voice = [
  ['s1-hook', 0.25], ['s2-start', 6.6], ['s3-class', 14.6], ['s4-team', 31.2], ['s5-trip', 39.6],
  ['s6-aws', 48.9], ['s7-memory', 74.5], ['s8-pip', 93.9], ['s9-end', 110.0],
];
const hosts = scenes.map(({ id, start, duration }, i) => `      <div id="${id}" data-composition-id="${id}" data-composition-src="compositions/${id}.html" data-start="${start}" data-duration="${duration}" data-track-index="${i % 2 ? 2 : 1}" data-track-kind="graphics" data-width="${W}" data-height="${H}" style="z-index:${i + 1}"></div>`).join('\n');
const voiceTags = voice.map(([id, t]) => `      <audio id="vo-${id}" class="clip" src="assets/voice/${id}.norm.mp3" data-start="${t}" data-duration="${durationOf(`./assets/voice/${id}.norm.mp3`)}" data-track-index="10" data-volume="1"></audio>`).join('\n');
const sfxTags = sfx.map((s, i) => `      <audio id="fx-${String(i).padStart(2, '0')}-${s.name}" class="clip" src="assets/sfx/${s.name}.norm.mp3" data-start="${s.t}" data-duration="${durationOf(`./assets/sfx/${s.name}.norm.mp3`)}" data-track-index="${12 + (i % 3)}" data-volume="${s.volume}"></audio>`).join('\n');
const index = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
${fonts}
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: #ffffff; }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; background: #ffffff; font-family: 'Geist', sans-serif; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="${W}" data-height="${H}">
${hosts}
      <audio id="music-bed" class="clip" src="assets/music/bed.mp3" data-start="6.4" data-duration="${(total - 6.4).toFixed(1)}" data-track-index="11" data-volume="0.15" data-fade-in="0.6" data-fade-out="2.2"></audio>
${voiceTags}
${sfxTags}
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
writeFileSync(new URL('./index.html', import.meta.url), index);
console.log(`wrote ${scenes.length} scenes, ${sfx.length} effects, ${total}s`);
