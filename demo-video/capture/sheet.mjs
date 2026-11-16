// Contact sheet of frames from a clip: node sheet.mjs <clip> t1 t2 ...  -> raw/sheet-<clip>.png
import { execFileSync } from 'node:child_process';
const [name, ...times] = process.argv.slice(2);
const clip = new URL(`../film/assets/clips/${name}.mp4`, import.meta.url).pathname;
const out = new URL(`./raw/sheet-${name}.png`, import.meta.url).pathname;
const inputs = times.flatMap((t) => ['-ss', t, '-i', clip]);
const scaled = times.map((t, i) => `[${i}:v]trim=end_frame=1,scale=800:-1,drawtext=text='${t}s':x=10:y=10:fontsize=28:fontcolor=red:box=1:boxcolor=white[v${i}]`).join(';');
const layout = times.map((_, k) => `${(k % 3) * 800}_${Math.floor(k / 3) * 450}`).join('|');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', `${scaled};${times.map((_, i) => `[v${i}]`).join('')}xstack=inputs=${times.length}:layout=${layout}`, '-frames:v', '1', out]);
console.log(out);
