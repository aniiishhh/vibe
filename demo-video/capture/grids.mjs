// Sheet of gridded frames (clip-pixel grid every 400px): node grids.mjs out.png clip:t clip:t ...
import { execFileSync } from 'node:child_process';
const [outName, ...items] = process.argv.slice(2);
const out = new URL(`./raw/${outName}`, import.meta.url).pathname;
let grid = '';
for (let x = 400; x < 3200; x += 400) grid += `drawbox=x=${x}:y=0:w=4:h=1800:c=red@0.6:t=fill,drawtext=text='${x}':x=${x + 6}:y=8:fontsize=44:fontcolor=red,`;
for (let y = 200; y < 1800; y += 200) grid += `drawbox=x=0:y=${y}:w=3200:h=${y % 400 ? 2 : 4}:c=red@0.6:t=fill,drawtext=text='${y}':x=8:y=${y + 6}:fontsize=44:fontcolor=red,`;
const inputs = items.flatMap((item) => { const [clip, t] = item.split(':'); return ['-ss', t, '-i', new URL(`../film/assets/clips/${clip}.mp4`, import.meta.url).pathname]; });
const chains = items.map((item, i) => `[${i}:v]trim=end_frame=1,${grid}drawtext=text='${item}':x=1200:y=1700:fontsize=70:fontcolor=blue:box=1:boxcolor=white,scale=1200:-1[v${i}]`).join(';');
const layout = items.map((_, k) => `${(k % 2) * 1200}_${Math.floor(k / 2) * 675}`).join('|');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', `${chains};${items.map((_, i) => `[v${i}]`).join('')}xstack=inputs=${items.length}:layout=${layout}`, '-frames:v', '1', out]);
console.log(out);
