// One frame with a 200px clip-pixel grid so camera targets can be read off: node grid.mjs clip t
import { execFileSync } from 'node:child_process';
const [name, t] = process.argv.slice(2);
const clip = new URL(`../film/assets/clips/${name}.mp4`, import.meta.url).pathname;
const out = new URL(`./raw/grid-${name}-${t}.png`, import.meta.url).pathname;
let vf = '';
for (let x = 400; x < 3200; x += 400) vf += `drawbox=x=${x}:y=0:w=3:h=1800:c=red@0.5:t=fill,drawtext=text='${x}':x=${x + 6}:y=8:fontsize=40:fontcolor=red,`;
for (let y = 400; y < 1800; y += 400) vf += `drawbox=x=0:y=${y}:w=3200:h=3:c=red@0.5:t=fill,drawtext=text='${y}':x=8:y=${y + 6}:fontsize=40:fontcolor=red,`;
vf += 'scale=1200:-1';
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', t, '-i', clip, '-frames:v', '1', '-vf', vf, out]);
console.log(out);
