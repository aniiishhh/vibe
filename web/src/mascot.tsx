import { memo, useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import type { BackdropId } from './backdrops';
import './mascot.css';

/**
 * Pip, Vibe's mascot: the coral pennant from the logo, hanging from a strand of
 * party bunting. Drawn in SVG. Body pose, eyes, blinks and arms are driven by a
 * small animation loop that blends between states; decorative bits are CSS.
 * Each chat theme adds a hat or glasses plus a held item. Idle Pip fidgets with
 * small actions on its own. Pauses off screen and holds still under reduced motion.
 */
export type MascotState =
  | 'idle' | 'wave' | 'listening' | 'curious' | 'excited' | 'laughing' | 'love' | 'sad'
  | 'summoned' | 'thinking' | 'working' | 'reading' | 'done' | 'error'
  | 'held' | 'dizzy' | 'sleeping' | 'mischief' | 'shocked' | 'zoom' | 'peek' | 'present';

export const MASCOT_STATES: ReadonlyArray<{ id: MascotState; label: string }> = [
  { id: 'idle', label: 'Idle' },
  { id: 'wave', label: 'Wave' },
  { id: 'listening', label: 'Listening' },
  { id: 'curious', label: 'Curious' },
  { id: 'excited', label: 'Excited' },
  { id: 'laughing', label: 'Laughing' },
  { id: 'love', label: 'Love' },
  { id: 'sad', label: 'Sad' },
  { id: 'summoned', label: 'Tagged' },
  { id: 'thinking', label: 'Thinking' },
  { id: 'working', label: 'Working' },
  { id: 'reading', label: 'Reading' },
  { id: 'done', label: 'Done' },
  { id: 'error', label: 'Error' },
  { id: 'held', label: 'Held' },
  { id: 'dizzy', label: 'Dizzy' },
  { id: 'sleeping', label: 'Sleeping' },
  { id: 'mischief', label: 'Mischief' },
  { id: 'shocked', label: 'Shocked' },
  { id: 'zoom', label: 'Flying' },
  { id: 'peek', label: 'Peeking' },
  { id: 'present', label: 'Presenting' },
];

type IdleAction = 'wave' | 'twirl' | 'stretch' | 'yawn' | 'hum' | 'lookaround' | 'bounce' | 'wink' | 'useProp' | 'juggle';
const IDLE_ACTIONS: IdleAction[] = ['wave', 'twirl', 'stretch', 'yawn', 'hum', 'lookaround', 'bounce', 'wink', 'useProp', 'useProp', 'juggle'];
const IDLE_DURATION: Record<IdleAction, number> = { wave: 2.2, twirl: 1.3, stretch: 2.2, yawn: 2.4, hum: 3.2, lookaround: 2.6, bounce: 1.8, wink: 1.4, useProp: 2.8, juggle: 2.6 };

interface Pose {
  x: number; y: number; tilt: number; sx: number; sy: number;
  lookX: number; lookY: number; eye: number; squint: number; happy: number;
  armL: number; armR: number; flag: number; pale: number; wink: number;
}

const rest = (): Pose => ({ x: 0, y: 0, tilt: 0, sx: 1, sy: 1, lookX: 0, lookY: 0, eye: 1, squint: 0, happy: 0, armL: 22, armR: 22, flag: 0, pale: 0, wink: 0 });
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const hop = (u: number) => (u <= 0 || u >= 1 ? 0 : 4 * u * (1 - u));
/** States whose position curve must be followed exactly rather than eased. */
const EXACT_STATES = new Set<MascotState>(['summoned', 'done', 'error', 'excited', 'laughing', 'held', 'dizzy', 'shocked', 'zoom', 'peek']);

const PIVOT = { x: 80, y: 38 };
const ARM_LENGTH = 30;
const ARM_ROOT_L = { x: 44, y: 60 };
const ARM_ROOT_R = { x: 116, y: 60 };

function armEnd(root: { x: number; y: number }, angle: number, side: 1 | -1) {
  const radians = (angle * Math.PI) / 180;
  return { x: root.x + side * Math.sin(radians) * ARM_LENGTH, y: root.y + Math.cos(radians) * ARM_LENGTH };
}

function armPath(root: { x: number; y: number }, angle: number, side: 1 | -1) {
  const end = armEnd(root, angle, side);
  const bend = armEnd(root, angle - 26, side);
  const control = { x: (root.x + bend.x) / 2 + side * 3, y: (root.y + bend.y) / 2 };
  return `M${root.x.toFixed(2)} ${root.y.toFixed(2)} Q${control.x.toFixed(2)} ${control.y.toFixed(2)} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export interface MascotProps {
  state?: MascotState;
  theme?: BackdropId | null;
  size?: number;
  /** Eyes follow the pointer while calm. */
  followPointer?: boolean;
  /** Where to look, -1..1 on each axis, overriding random glances (e.g. toward the message box). */
  lookAt?: { x: number; y: number } | null;
  /** Increments on each keystroke; Pip bobs and taps along. */
  pulse?: number;
  /** Horizontal drag velocity in px/frame while held; Pip swings against it. */
  swing?: number;
  /** Let idle Pip do little actions on its own. */
  fidget?: boolean;
  /** Ask idle Pip to do a specific action now (changes each time the key changes). */
  action?: { name: IdleAction; key: number } | null;
  animate?: boolean;
  label?: string;
  status?: string | null;
  className?: string;
}

function MascotView({
  state = 'idle', theme = null, size = 120, followPointer = false, lookAt = null, pulse = 0, swing = 0,
  fidget = true, animate = true, label, status, className = '', action = null,
}: MascotProps) {
  const uid = useId().replace(/:/g, '');
  const svgRef = useRef<SVGSVGElement>(null);
  const refs = {
    string: useRef<SVGPathElement>(null),
    body: useRef<SVGGElement>(null),
    eyes: useRef<SVGGElement>(null),
    eyeL: useRef<SVGEllipseElement>(null),
    eyeR: useRef<SVGEllipseElement>(null),
    glintL: useRef<SVGCircleElement>(null),
    glintR: useRef<SVGCircleElement>(null),
    lids: useRef<SVGGElement>(null),
    happy: useRef<SVGGElement>(null),
    armL: useRef<SVGPathElement>(null),
    armR: useRef<SVGPathElement>(null),
    handL: useRef<SVGCircleElement>(null),
    handR: useRef<SVGCircleElement>(null),
    flagL: useRef<SVGGElement>(null),
    flagR: useRef<SVGGElement>(null),
    pale: useRef<SVGPathElement>(null),
    sparkBack: useRef<SVGGElement>(null),
    sparkFront: useRef<SVGGElement>(null),
    holdL: useRef<SVGGElement>(null),
    holdR: useRef<SVGGElement>(null),
    winkLid: useRef<SVGPathElement>(null),
  };
  const [idleAction, setIdleAction] = useState<IdleAction | null>(null);
  const options = useRef({ state, followPointer, animate, lookAt, pulse, swing, idleAction });
  options.current = { state, followPointer, animate, lookAt, pulse, swing, idleAction };

  // Idle fidgets: every few seconds of idling, one small action.
  useEffect(() => {
    if (state !== 'idle' || !fidget || !animate) { setIdleAction(null); return; }
    let clear = 0;
    let previous: IdleAction | null = null;
    const run = () => {
      const choices = IDLE_ACTIONS.filter((action) => action !== previous);
      const action = choices[Math.floor(Math.random() * choices.length)];
      previous = action;
      setIdleAction(action);
      clear = window.setTimeout(() => setIdleAction(null), IDLE_DURATION[action] * 1000);
    };
    const first = window.setTimeout(run, 2_200);
    const timer = window.setInterval(run, 6_000);
    return () => { window.clearTimeout(first); window.clearTimeout(clear); window.clearInterval(timer); setIdleAction(null); };
  }, [state, fidget, animate]);

  useEffect(() => {
    if (!action) return;
    setIdleAction(action.name);
    const timer = window.setTimeout(() => setIdleAction(null), IDLE_DURATION[action.name] * 1000);
    return () => window.clearTimeout(timer);
  }, [action?.key]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const start = performance.now() / 1000;
    let last = start;
    let raf = 0;
    let visible = true;
    let current: string = options.current.state;
    let since = 0;
    let actionKey: string | null = null;
    let actionSince = 0;
    let lastPulse = options.current.pulse;
    let pulseAt = -10;
    const pose = rest();
    let gaze = { x: 0, y: 0, until: 0 };
    let blinkAt = 1.5 + Math.random() * 2;
    let pointer: { x: number; y: number } | null = null;

    const target = (t: number): { pose: Pose; blink: number; spark: number } => {
      const o = options.current;
      const s = o.state;
      const u = t - since;
      const p = rest();
      const breath = Math.sin(t * 1.8);
      let spark = -1;
      p.sy = 1 + 0.024 * breath;
      p.sx = 1 - 0.012 * breath;
      p.tilt = Math.sin(t * 0.9) * 3.8 + Math.sin(t * 2.3) * 1;
      p.flag = Math.sin(t * 2.1) * 7;
      p.armL = 22 + Math.sin(t * 1.8) * 4;
      p.armR = 22 + Math.sin(t * 1.8 + 1) * 4;

      if (o.followPointer && pointer) {
        p.lookX = pointer.x * 3.4;
        p.lookY = pointer.y * 2.8;
      } else if (o.lookAt) {
        p.lookX = clamp(o.lookAt.x, -1, 1) * 3.6;
        p.lookY = clamp(o.lookAt.y, -1, 1) * 3;
      } else {
        if (t > gaze.until) gaze = { x: (Math.random() - 0.5) * 5.6, y: (Math.random() - 0.5) * 3.4, until: t + 1.2 + Math.random() * 2.4 };
        p.lookX = gaze.x;
        p.lookY = gaze.y;
      }

      switch (s) {
        case 'idle': {
          const action = o.idleAction;
          const v = t - actionSince;
          if (action === 'wave') { p.armR = 138 + Math.sin(t * 13) * 26; p.tilt = 5 + Math.sin(t * 6) * 2; }
          if (action === 'twirl') { const turn = clamp(v / 1.1, 0, 1); p.sx = Math.cos(turn * Math.PI * 2); if (Math.abs(p.sx) < 0.06) p.sx = 0.06 * Math.sign(p.sx || 1); p.y = -6 * hop(turn); p.armL = p.armR = 70; }
          if (action === 'stretch') { const k = hop(clamp(v / 2, 0, 1)); p.sy = 1 + 0.12 * k; p.sx = 1 - 0.06 * k; p.armL = p.armR = 22 + 150 * k; p.squint = 0.7 * k; }
          if (action === 'yawn') { const k = hop(clamp(v / 2.3, 0, 1)); p.squint = 0.85 * k; p.tilt = -5 * k; p.armL = 22 + 120 * k; p.sy = 1 + 0.05 * k; }
          if (action === 'hum') { p.tilt = Math.sin(t * 4) * 8; p.squint = 0.45; p.armL = 40 + Math.sin(t * 4) * 18; p.armR = 40 - Math.sin(t * 4) * 18; p.flag = Math.sin(t * 4) * 12; }
          if (action === 'lookaround') { p.lookX = Math.sin(v * 2.6) * 4; p.lookY = -1; p.tilt = Math.sin(v * 2.6) * 7; }
          if (action === 'bounce') { p.y = -10 * Math.abs(Math.sin(v * 6)); p.sy = 1 + 0.05 * Math.sin(v * 12); p.armL = p.armR = 60; }
          if (action === 'wink') { const k = hop(clamp(v / 1.3, 0, 1)); p.wink = clamp(k * 1.8, 0, 1); p.tilt = 7 * k; p.lookX = 2.5 * k; p.armL = 22 + 60 * k; }
          if (action === 'useProp') { const k = clamp(Math.min(v / 0.4, (2.8 - v) / 0.4), 0, 1); p.armR = 22 + (-62 - 22) * k + Math.sin(t * 7) * 4 * k; p.lookX = 1.8 * k; p.lookY = 2.6 * k; p.tilt = -4 * k; p.squint = 0.25 * k; }
          if (action === 'juggle') { p.armL = 100 + Math.sin(v * 9) * 36; p.armR = 100 - Math.sin(v * 9) * 36; p.lookY = -3; p.lookX = Math.sin(v * 4.5) * 3; p.y = -2 * Math.abs(Math.sin(v * 9)); }
          break;
        }
        case 'wave':
          p.armR = 140 + Math.sin(t * 12) * 30;
          p.tilt = 6 + Math.sin(t * 6) * 3;
          p.y = -3 * Math.abs(Math.sin(t * 3));
          break;
        case 'listening':
          p.tilt = -8 + Math.sin(t * 2.2) * 1.4;
          if (!o.lookAt) { p.lookX = -2.6; p.lookY = 2.8; }
          p.y = 1.8 * Math.max(0, Math.sin(t * 4.2));
          p.armL = 44;
          break;
        case 'curious':
          p.tilt = -16 + Math.sin(t * 1.3) * 2.5;
          p.eye = 1.12;
          p.armL = 112 + Math.sin(t * 2) * 5;
          p.flag = Math.sin(t * 3) * 6;
          break;
        case 'excited':
          p.y = -8 * Math.abs(Math.sin(t * 8));
          p.sy = 1 + 0.06 * Math.sin(t * 16);
          p.sx = 2 - p.sy;
          p.eye = 1.25;
          p.tilt = Math.sin(t * 8) * 5;
          p.armL = 150 + Math.sin(t * 16) * 16;
          p.armR = 150 + Math.sin(t * 16 + 1.5) * 16;
          p.flag = Math.sin(t * 16) * 16;
          break;
        case 'laughing':
          p.happy = 1;
          p.y = -2.4 * Math.abs(Math.sin(t * 14));
          p.tilt = Math.sin(t * 14) * 3.5 + 4;
          p.sy = 1 + 0.045 * Math.sin(t * 28);
          p.armL = 64 + Math.sin(t * 14) * 12;
          p.armR = 64 + Math.sin(t * 14 + 2) * 12;
          p.flag = Math.sin(t * 14) * 10;
          break;
        case 'love':
          p.tilt = Math.sin(t * 1.6) * 7;
          p.y = -2.5 * Math.abs(Math.sin(t * 2.2));
          p.armL = 72 + Math.sin(t * 2.2) * 6;
          p.armR = 72 + Math.sin(t * 2.2 + 0.5) * 6;
          break;
        case 'sad':
          p.tilt = 5 + Math.sin(t * 0.7) * 1.6;
          p.sy = 0.95;
          p.y = 3;
          p.lookY = 3;
          p.lookX *= 0.3;
          p.squint = 0.25;
          p.armL = 4;
          p.armR = 4;
          p.flag = Math.sin(t * 0.9) * 2;
          break;
        case 'summoned': {
          const jump = hop(u / 0.55);
          p.y = -14 * jump;
          p.sy = u < 0.12 ? 1 - 0.13 * Math.sin((u / 0.12) * Math.PI) : 1 + 0.05 * jump;
          p.sx = 2 - p.sy;
          p.eye = 1.3;
          p.tilt = Math.sin(t * 26) * 2.5 * Math.exp(-u * 2.5);
          p.armL = 150 + Math.sin(t * 9) * 12;
          p.armR = 150 + Math.sin(t * 9 + 1.4) * 12;
          p.flag = Math.sin(t * 14) * 14;
          if (u > 0.6) p.y = -3 * Math.abs(Math.sin(t * 5));
          break;
        }
        case 'thinking':
          p.tilt = 7 + Math.sin(t * 0.8) * 2;
          p.lookX = 2.6 + Math.sin(t * 0.7) * 0.6;
          p.lookY = -3.2;
          p.squint = 0.4;
          p.armL = 118 + Math.sin(t * 1.6) * 5;
          p.armR = 18;
          break;
        case 'working': {
          const a = t * 2.4;
          spark = a;
          p.lookX = Math.cos(a) * 3.6;
          p.lookY = -0.8 + Math.sin(a) * 1.2;
          p.tilt = Math.cos(a) * 5;
          p.armL = 50 + Math.sin(t * 15) * 12;
          p.armR = 50 + Math.sin(t * 15 + 2) * 12;
          p.flag = Math.sin(t * 6) * 9;
          break;
        }
        case 'reading':
          p.lookX = (((t * 0.8) % 1) * 2 - 1) * 3.4;
          p.lookY = 1.6;
          p.tilt = -4 + Math.sin(t * 0.8) * 1.5;
          p.y = 1.2 * Math.max(0, Math.sin(t * 3));
          p.armL = 70;
          p.armR = 70;
          break;
        case 'done': {
          const v = u / 1.15;
          const crouch = v < 0.14 ? Math.sin((v / 0.14) * Math.PI) : 0;
          const air = v >= 0.14 && v < 0.75 ? hop((v - 0.14) / 0.61) : 0;
          const land = v >= 0.75 && v < 0.93 ? Math.sin(((v - 0.75) / 0.18) * Math.PI) : 0;
          p.y = -20 * air;
          p.sy = 1 - 0.14 * crouch - 0.12 * land + 0.08 * air;
          p.sx = 2 - p.sy;
          p.happy = 1;
          p.tilt = -7 * Math.sin(v * Math.PI * 2) * (v < 1 ? 1 : 0.3);
          p.armL = 148 + Math.sin(t * 8) * 14;
          p.armR = 148 + Math.sin(t * 8 + 1) * 14;
          p.flag = Math.sin(t * 12) * 14;
          break;
        }
        case 'error': {
          const cycle = u % 2.4;
          const shake = cycle < 0.6 ? 1 - cycle / 0.6 : 0;
          p.x = Math.sin(cycle * 42) * 3.4 * shake;
          p.tilt = 0;
          p.sy = 0.95;
          p.sx = 1.02;
          p.eye = 1.25;
          p.lookY = -0.5;
          p.lookX = 0;
          p.pale = 1;
          p.armL = 8;
          p.armR = 8;
          p.flag = Math.sin(t * 3) * 2;
          break;
        }
        case 'held':
          p.tilt = clamp(-o.swing * 2.2, -38, 38) + Math.sin(t * 7) * 5;
          p.sy = 1.06;
          p.sx = 0.96;
          p.eye = 1.3;
          p.armL = 150 + Math.sin(t * 15) * 24;
          p.armR = 150 + Math.sin(t * 15 + 2) * 24;
          p.flag = Math.sin(t * 18) * 18;
          p.lookX = clamp(o.swing * 0.4, -3.5, 3.5);
          break;
        case 'dizzy':
          p.tilt = Math.sin(t * 6) * 12 * Math.exp(-u * 0.6) + Math.sin(t * 2) * 3;
          p.x = Math.sin(t * 3) * 2.4;
          p.armL = 34 + Math.sin(t * 6) * 10;
          p.armR = 34 - Math.sin(t * 6) * 10;
          p.sy = 0.97;
          break;
        case 'mischief':
          p.tilt = -9 + Math.sin(t * 3) * 3;
          p.lookX = -3.2;
          p.lookY = 0.6;
          p.squint = 0.38;
          p.wink = 0;
          p.armL = 120 + Math.sin(t * 10) * 10;
          p.armR = -40 + Math.sin(t * 10) * 6;
          p.y = -2 * Math.abs(Math.sin(t * 5));
          break;
        case 'shocked': {
          const jolt = Math.exp(-u * 5);
          p.y = -10 * jolt;
          p.sy = 1.08 - 0.06 * (1 - jolt);
          p.sx = 2 - p.sy;
          p.eye = 1.45;
          p.lookX = 0;
          p.lookY = -0.5;
          p.armL = 165 + Math.sin(t * 20) * 6 * jolt;
          p.armR = 165 + Math.sin(t * 20 + 1) * 6 * jolt;
          p.flag = Math.sin(t * 20) * 16 * jolt;
          p.tilt = Math.sin(t * 30) * 3 * jolt;
          break;
        }
        case 'zoom':
          p.tilt = clamp(-o.swing * 1.6, -30, 30);
          p.sy = 1.08;
          p.sx = 0.92;
          p.eye = 1.12;
          p.squint = 0.3;
          p.lookX = clamp(o.swing * 0.5, -3.5, 3.5);
          p.armL = 170 + Math.sin(t * 22) * 8;
          p.armR = 170 + Math.sin(t * 22 + 1.6) * 8;
          p.flag = Math.sin(t * 24) * 22;
          break;
        case 'peek': {
          // Leaning over the message box edge, eyes on the caret; a cheeky giggle now and then.
          const lean = o.lookAt ? clamp(o.lookAt.x, -1, 1) : 0;
          const g = (t % 4.6) / 4.6;
          const giggle = g > 0.78 ? hop((g - 0.78) / 0.22) : 0;
          p.tilt = -lean * 12 + Math.sin(t * 2.4) * 2;
          p.y = 3 + Math.sin(t * 3.2) * 1.4;
          p.lookX = lean * 3.6;
          p.lookY = 3.6;
          p.squint = 0.3 + 0.5 * giggle;
          p.happy = giggle > 0.4 ? 1 : 0;
          p.armL = 8 - 84 * giggle;
          p.armR = 8;
          p.x = Math.sin(t * 18) * 1.2 * giggle;
          break;
        }
        case 'present':
          p.tilt = 7 + Math.sin(t * 3) * 2;
          p.lookX = -3.6;
          p.lookY = 0.8;
          p.armL = 92 + Math.sin(t * 6) * 10;
          p.armR = 150 + Math.sin(t * 9) * 14;
          p.y = -3 * Math.abs(Math.sin(t * 4.5));
          p.flag = Math.sin(t * 9) * 12;
          p.eye = 1.1;
          break;
        case 'sleeping':
          p.tilt = 8 + Math.sin(t * 0.55) * 2.6;
          p.sy = 1 + 0.035 * Math.sin(t * 1.1);
          p.y = 2;
          p.armL = 4;
          p.armR = 6;
          p.flag = Math.sin(t * 0.9) * 2;
          break;
      }

      // Each keystroke: a quick bob, a jiggle and a tap.
      const k = Math.exp(-(t - pulseAt) * 7);
      if (k > 0.01 && s !== 'held' && s !== 'sleeping') {
        p.y += 4 * k;
        p.tilt += Math.sin((t - pulseAt) * 32) * 2.5 * k;
        p.armR += 34 * k;
        p.armL += 14 * k;
      }

      let blink = 0;
      if (s === 'sleeping') blink = 1;
      else {
        if (t > blinkAt + 0.16) blinkAt = t + (s === 'error' ? 5 : 2.4) + Math.random() * 3.2;
        const b = (t - blinkAt) / 0.16;
        if (b >= 0 && b <= 1) blink = b < 0.45 ? b / 0.45 : 1 - (b - 0.45) / 0.55;
      }
      return { pose: p, blink, spark };
    };

    let blinkNow = 0;
    let sparkAngle = -1;

    const apply = () => {
      const p = pose;
      const r = refs;
      r.body.current?.setAttribute('transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${p.tilt.toFixed(2)} ${PIVOT.x} ${PIVOT.y}) translate(${PIVOT.x} ${PIVOT.y}) scale(${p.sx.toFixed(3)} ${p.sy.toFixed(3)}) translate(${-PIVOT.x} ${-PIVOT.y})`);
      r.string.current?.setAttribute('d', `M4 26 Q80 ${(46 + p.y * 0.85).toFixed(2)} 156 26`);
      r.eyes.current?.setAttribute('transform', `translate(${p.lookX.toFixed(2)} ${p.lookY.toFixed(2)})`);
      const open = (1 - blinkNow * 0.94) * (1 - p.squint * 0.45) * (1 - p.happy);
      const ry = 8.6 * p.eye * open;
      const rx = 5.7 * p.eye * (1 + 0.1 * blinkNow);
      const cy = 70 - p.squint * 1.2;
      for (const [eye, glint, cx, winkAmount] of [[r.eyeL.current, r.glintL.current, 66, 0], [r.eyeR.current, r.glintR.current, 94, p.wink]] as const) {
        if (!eye || !glint) continue;
        const eyeRy = ry * (1 - winkAmount * 0.96);
        eye.setAttribute('rx', rx.toFixed(2));
        eye.setAttribute('ry', Math.max(0.01, eyeRy).toFixed(2));
        eye.setAttribute('cy', cy.toFixed(2));
        eye.style.opacity = eyeRy < 0.8 ? '0' : '1';
        glint.setAttribute('cx', (cx + 1.9 * p.eye).toFixed(2));
        glint.setAttribute('cy', (cy - eyeRy * 0.42).toFixed(2));
        glint.setAttribute('r', (1.9 * p.eye).toFixed(2));
        glint.style.opacity = eyeRy < 3.5 ? '0' : '1';
      }
      if (r.winkLid.current) r.winkLid.current.style.opacity = p.wink > 0.6 && ry > 0.8 ? '1' : '0';
      if (r.lids.current) r.lids.current.style.opacity = ry < 0.8 && p.happy < 0.5 ? '1' : '0';
      if (r.happy.current) r.happy.current.style.opacity = clamp(p.happy * 1.6 - 0.3, 0, 1).toFixed(2);
      r.armL.current?.setAttribute('d', armPath(ARM_ROOT_L, p.armL, -1));
      r.armR.current?.setAttribute('d', armPath(ARM_ROOT_R, p.armR, 1));
      const handL = armEnd(ARM_ROOT_L, p.armL, -1);
      const handR = armEnd(ARM_ROOT_R, p.armR, 1);
      r.handL.current?.setAttribute('cx', handL.x.toFixed(2));
      r.handL.current?.setAttribute('cy', handL.y.toFixed(2));
      r.handR.current?.setAttribute('cx', handR.x.toFixed(2));
      r.handR.current?.setAttribute('cy', handR.y.toFixed(2));
      r.holdL.current?.setAttribute('transform', `translate(${handL.x.toFixed(2)} ${(handL.y - 1).toFixed(2)}) scale(2.35)`);
      r.holdR.current?.setAttribute('transform', `translate(${handR.x.toFixed(2)} ${(handR.y - 1).toFixed(2)}) rotate(${(-(p.armR - 22) * 0.45).toFixed(1)}) scale(2.35)`);
      r.flagL.current?.setAttribute('transform', `rotate(${p.flag.toFixed(2)} 27 31)`);
      r.flagR.current?.setAttribute('transform', `rotate(${(-p.flag * 0.9).toFixed(2)} 133 31)`);
      if (r.pale.current) r.pale.current.style.opacity = (p.pale * 0.62).toFixed(2);
      const showSpark = sparkAngle >= 0 && options.current.state === 'working';
      const sx = 80 + Math.cos(sparkAngle) * 62;
      const sy = 58 + Math.sin(sparkAngle) * 16;
      const front = Math.sin(sparkAngle) > 0;
      const depth = 0.72 + 0.28 * Math.sin(sparkAngle);
      for (const [group, isFront] of [[r.sparkBack.current, false], [r.sparkFront.current, true]] as const) {
        if (!group) continue;
        group.style.opacity = showSpark && front === isFront ? '1' : '0';
        group.setAttribute('transform', `translate(${sx.toFixed(2)} ${sy.toFixed(2)}) rotate(${((sparkAngle * 180) / Math.PI) % 360}) scale(${depth.toFixed(2)})`);
      }
    };

    const step = (t: number, dt: number) => {
      const o = options.current;
      if (o.state !== current) { current = o.state; since = t; }
      if (o.idleAction !== actionKey) { actionKey = o.idleAction; actionSince = t; }
      if (o.pulse !== lastPulse) { lastPulse = o.pulse; pulseAt = t; }
      const goal = target(t);
      const k = 1 - Math.exp(-dt * 11);
      for (const key of Object.keys(goal.pose) as Array<keyof Pose>) pose[key] += (goal.pose[key] - pose[key]) * k;
      const exact = EXACT_STATES.has(o.state) || (o.state === 'idle' && (o.idleAction === 'twirl' || o.idleAction === 'bounce' || o.idleAction === 'juggle'));
      if (exact) {
        pose.y = goal.pose.y;
        pose.x = goal.pose.x;
        pose.sy += (goal.pose.sy - pose.sy) * 0.6;
        pose.sx = o.idleAction === 'twirl' ? goal.pose.sx : pose.sx + (goal.pose.sx - pose.sx) * 0.6;
      }
      if (t - pulseAt < 0.3) pose.y += (goal.pose.y - pose.y) * 0.5;
      blinkNow = goal.blink;
      sparkAngle = goal.spark;
    };

    const still = () => {
      const goal = target(1.2);
      Object.assign(pose, goal.pose);
      pose.y = 0;
      pose.sx = 1;
      blinkNow = goal.blink;
      sparkAngle = options.current.state === 'working' ? 0.9 : -1;
      apply();
    };

    const tick = (now: number) => {
      raf = 0;
      if (!visible) return;
      if (!options.current.animate || reduce.matches) { still(); return; }
      const t = now / 1000 - start;
      const dt = Math.min(0.1, Math.max(0, now / 1000 - last));
      last = now / 1000;
      step(t, dt);
      apply();
      raf = requestAnimationFrame(tick);
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(tick); };

    const observer = new IntersectionObserver((entries) => {
      visible = Boolean(entries[entries.length - 1]?.isIntersecting);
      if (visible) { last = performance.now() / 1000; schedule(); }
    });
    observer.observe(svg);
    const onPointer = (event: PointerEvent) => {
      const box = svg.getBoundingClientRect();
      pointer = {
        x: clamp((event.clientX - (box.left + box.width / 2)) / (box.width * 2), -1, 1),
        y: clamp((event.clientY - (box.top + box.height / 2)) / (box.height * 2), -1, 1),
      };
    };
    const onLeave = () => { pointer = null; };
    window.addEventListener('pointermove', onPointer, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    reduce.addEventListener('change', schedule);
    apply();
    schedule();
    const keepAlive = window.setInterval(schedule, 1000);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(keepAlive);
      observer.disconnect();
      window.removeEventListener('pointermove', onPointer);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      reduce.removeEventListener('change', schedule);
    };
    // Mounted once; prop changes flow through the options ref.
  }, []);

  const body = 'M43 35.5Q80 48 117 35.5Q123.5 34 122 41.5C119 78 104 112 88.5 131Q80 141.5 71.5 131C56 112 41 78 38 41.5Q36.5 34 43 35.5Z';
  const face = state === 'idle' && idleAction === 'yawn' ? 'yawn' : state === 'idle' && idleAction === 'hum' ? 'hum' : state === 'idle' && (idleAction === 'wink' || idleAction === 'juggle') ? 'wave' : state === 'idle' && idleAction === 'useProp' ? 'hum' : state;
  const altEyes = state === 'love' || state === 'dizzy';

  return (
    <span className={`pip pip-${state}${idleAction ? ` pip-action-${idleAction}` : ''}${theme ? ` pip-theme-${theme}` : ''}${altEyes ? ' pip-alt-eyes' : ''} ${className}`} style={{ width: size }}>
      <svg ref={svgRef} className="pip-svg" viewBox="0 0 160 160" width={size} height={size} role="img" aria-label={`Pip${status ? `, ${status}` : ''}`}>
        <defs>
          <linearGradient id={`${uid}-skin`} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0" stopColor="#ff8a6c" />
            <stop offset="0.55" stopColor="#f2634b" />
            <stop offset="1" stopColor="#db4834" />
          </linearGradient>
          <filter id={`${uid}-shadow`} x="-30%" y="-20%" width="160%" height="150%">
            <feDropShadow dx="0" dy="5" stdDeviation="4.5" floodColor="#3a1810" floodOpacity="0.24" />
          </filter>
        </defs>

        <path ref={refs.string} className="pip-string" d="M4 26 Q80 46 156 26" />
        <g ref={refs.flagL}><path className="pip-flag pip-flag-amber" d="M14 28.6Q27 33 40 34.6L31 58Q27 65 23 58Z" /></g>
        <g ref={refs.flagR}><path className="pip-flag pip-flag-teal" d="M120 34.6Q133 33 146 28.6L137 58Q133 65 129 58Z" /></g>

        <Decor state={state} idleAction={idleAction} />

        <g ref={refs.sparkBack} className="pip-spark" style={{ opacity: 0 }}><path d="M0-7 2-2 7 0 2 2 0 7-2 2-7 0-2-2Z" /></g>

        <g ref={refs.body}>
          <path ref={refs.armL} className="pip-arm" d="" />
          <path ref={refs.armR} className="pip-arm" d="" />

          <g filter={`url(#${uid}-shadow)`}><path d={body} fill={`url(#${uid}-skin)`} /></g>
          <path ref={refs.pale} d={body} className="pip-pale" style={{ opacity: 0 }} />
          <path className="pip-sheen" d="M45 41.5Q53 44 60 45C57 60 54 72 50.5 84C46.5 70 45 56 45 41.5Z" />

          <ellipse className="pip-cheek" cx="60.5" cy="83" rx="5.4" ry="3.2" />
          <ellipse className="pip-cheek" cx="99.5" cy="83" rx="5.4" ry="3.2" />

          <Brows state={state} />

          <g ref={refs.eyes}>
            <ellipse ref={refs.eyeL} className="pip-eye" cx="66" cy="70" rx="5.7" ry="8.6" />
            <ellipse ref={refs.eyeR} className="pip-eye" cx="94" cy="70" rx="5.7" ry="8.6" />
            <circle ref={refs.glintL} className="pip-glint" cx="68" cy="66" r="1.9" />
            <circle ref={refs.glintR} className="pip-glint" cx="96" cy="66" r="1.9" />
            <g ref={refs.lids} className="pip-lid" style={{ opacity: 0 }}><path d="M60 71q6 3.5 12 0M88 71q6 3.5 12 0" /></g>
            <g ref={refs.happy} className="pip-lid" style={{ opacity: 0 }}><path d="M59.5 72q6.5-9 13 0M87.5 72q6.5-9 13 0" /></g>
            <path ref={refs.winkLid} className="pip-wink" style={{ opacity: 0 }} d="M87.5 71.5q6.5-6.5 13 0" />
            {state === 'love' && (
              <g className="pip-heart-eyes">
                <path d="M66 78.5c-6-4-9-7-9-10.6a4.4 4.4 0 0 1 9-1.6 4.4 4.4 0 0 1 9 1.6c0 3.6-3 6.6-9 10.6Z" />
                <path d="M94 78.5c-6-4-9-7-9-10.6a4.4 4.4 0 0 1 9-1.6 4.4 4.4 0 0 1 9 1.6c0 3.6-3 6.6-9 10.6Z" />
              </g>
            )}
            {state === 'dizzy' && (
              <g className="pip-spiral-eyes">
                <path d="M66 70m-1 0a1 1 0 0 1 2 0a2.4 2.4 0 0 1-4.6.4a3.8 3.8 0 0 1 7.4-1.4a5.4 5.4 0 0 1-10.4 2" />
                <path d="M94 70m-1 0a1 1 0 0 1 2 0a2.4 2.4 0 0 1-4.6.4a3.8 3.8 0 0 1 7.4-1.4a5.4 5.4 0 0 1-10.4 2" />
              </g>
            )}
          </g>

          <Mouth face={face} />
          <ThemeProp theme={theme} state={state} />
          <g ref={refs.holdL}>{state === 'idle' && idleAction === 'juggle' && <JuggleBalls />}</g>
          <g ref={refs.holdR}>{theme && !(state === 'idle' && idleAction === 'juggle') && <g className={`pip-held-wrap pip-held-${theme}`}><HeldItem theme={theme} /></g>}</g>
          <circle ref={refs.handL} className="pip-hand" r="5.6" cx="40" cy="76" />
          <circle ref={refs.handR} className="pip-hand" r="5.6" cx="120" cy="76" />
        </g>

        <g ref={refs.sparkFront} className="pip-spark" style={{ opacity: 0 }}><path d="M0-7 2-2 7 0 2 2 0 7-2 2-7 0-2-2Z" /></g>
        <FrontDecor state={state} />
      </svg>
      {label && (
        <span className="pip-tag">
          <strong>{label}</strong>
          {status && <span className="pip-tag-status" key={status}>{status}</span>}
        </span>
      )}
    </span>
  );
}

function Brows({ state }: { state: MascotState }) {
  const d: Partial<Record<MascotState, string>> = {
    working: 'M59 57.5l11 2.2M101 57.5l-11 2.2',
    error: 'M59 58l10-3.6M101 58l-10-3.6',
    summoned: 'M59.5 55.5q5.5-4 11 0M89.5 55.5q5.5-4 11 0',
    excited: 'M59.5 55q5.5-4 11 0M89.5 55q5.5-4 11 0',
    thinking: 'M60 58q5-2 10 0M89.5 55q5.5-3.5 11-.5',
    curious: 'M60 58.5q5-1.5 10 0M89 54q6-4.5 12-1',
    sad: 'M59.5 57.5l10-3.2M100.5 57.5l-10-3.2',
    held: 'M59.5 55q5.5-4.5 11 0M89.5 55q5.5-4.5 11 0',
    mischief: 'M59 57.5l11 1.5M89 53q6-4 12-.5',
    peek: 'M59 57.5l11 1.5M89 53q6-4 12-.5',
    present: 'M59.5 55q5.5-4 11 0M89.5 55q5.5-4 11 0',
    shocked: 'M59 53q5.5-5 11 0M89.5 53q5.5-5 11 0',
    zoom: 'M59 57l11 1M90 58l11-1',
  };
  return d[state] ? <path key={state} className="pip-brow" d={d[state]} /> : null;
}

function Mouth({ face }: { face: MascotState | 'yawn' | 'hum' }) {
  switch (face) {
    case 'summoned':
    case 'held':
      return <g className="pip-mouth" key={face}><ellipse cx="80" cy="90.5" rx="4.8" ry="5.8" className="pip-ink" /><ellipse cx="80" cy="93.4" rx="3" ry="2" className="pip-tongue" /></g>;
    case 'yawn':
      return <g className="pip-mouth" key={face}><ellipse cx="80" cy="91" rx="5.4" ry="7.2" className="pip-ink" /><ellipse cx="80" cy="95" rx="3.4" ry="2.2" className="pip-tongue" /></g>;
    case 'done':
    case 'excited':
    case 'present':
    case 'laughing':
      return <g className="pip-mouth" key={face}><path d="M69 86Q80 101 91 86Q80 89.5 69 86Z" className="pip-ink" /><path d="M75 91.8Q80 96.5 85 91.8Q80 90 75 91.8Z" className="pip-tongue" /></g>;
    case 'love':
    case 'wave':
      return <g className="pip-mouth" key={face}><path d="M71 86.5Q80 97 89 86.5Q80 89 71 86.5Z" className="pip-ink" /><path d="M76 91.2Q80 94.4 84 91.2Q80 90 76 91.2Z" className="pip-tongue" /></g>;
    case 'sad':
      return <path className="pip-mouth pip-line" key={face} d="M72.5 93Q80 86.5 87.5 93" />;
    case 'mischief':
    case 'peek':
    case 'zoom':
      return <g className="pip-mouth" key={face}><path d="M70 86.5Q82 98 91 84.5Q82 89.5 70 86.5Z" className="pip-ink" /><path d="M80 92.3l3.4.2-.3 3.2Z" fill="#fff" /></g>;
    case 'shocked':
      return <g className="pip-mouth" key={face}><ellipse cx="80" cy="92" rx="6" ry="8" className="pip-ink" /><ellipse cx="80" cy="96.4" rx="3.6" ry="2.4" className="pip-tongue" /></g>;
    case 'curious':
      return <ellipse className="pip-mouth pip-ink" key={face} cx="82" cy="90" rx="2.6" ry="3" />;
    case 'thinking':
      return <path className="pip-mouth pip-line" key={face} d="M75 90.5q3-1.6 6 0t5-.6" />;
    case 'working':
    case 'reading':
      return <path className="pip-mouth pip-line" key={face} d="M75 90h10" />;
    case 'error':
    case 'dizzy':
      return <path className="pip-mouth pip-line" key={face} d="M70.5 91.5q2.4-3 4.75 0t4.75 0 4.75 0 4.75 0" />;
    case 'sleeping':
      return <ellipse className="pip-mouth pip-ink" key={face} cx="80" cy="90" rx="2.4" ry="2.8" />;
    case 'hum':
      return <ellipse className="pip-mouth pip-ink" key={face} cx="80" cy="90" rx="3" ry="2.4" />;
    case 'listening':
      return <path className="pip-mouth pip-line" key={face} d="M74 88.5Q80 93 86 88.5" />;
    default:
      return <path className="pip-mouth pip-line" key={face} d="M72.5 87.5Q80 94.5 87.5 87.5" />;
  }
}

/** Effects drawn behind the body. */
function Decor({ state, idleAction }: { state: MascotState; idleAction: IdleAction | null }) {
  return (
    <>
      {state === 'thinking' && (
        <g className="pip-thoughts">
          <circle className="pip-thought pip-thought-1" cx="118" cy="44" r="3.2" />
          <circle className="pip-thought pip-thought-2" cx="127" cy="32" r="5" />
          <g className="pip-thought pip-thought-3">
            <path d="M126 20a7.5 7.5 0 0 1 9.5-8.5 8.5 8.5 0 0 1 15 3 6.5 6.5 0 0 1 1 12.5h-22.5a6.5 6.5 0 0 1-3-7Z" />
            <circle className="pip-thought-dot" cx="134.5" cy="20" r="1.8" />
            <circle className="pip-thought-dot" cx="140" cy="20" r="1.8" />
            <circle className="pip-thought-dot" cx="145.5" cy="20" r="1.8" />
          </g>
        </g>
      )}
      {state === 'curious' && <path className="pip-question" d="M118 30a7 7 0 1 1 10 6.4c-2 1-3 2.2-3 4.6M125 48v.5" />}
      {state === 'sleeping' && (
        <g className="pip-zzz">
          <path className="pip-z pip-z-1" d="M112 46h7l-7 8h7" />
          <path className="pip-z pip-z-2" d="M121 32h9l-9 10h9" />
          <path className="pip-z pip-z-3" d="M132 16h11l-11 12h11" />
        </g>
      )}
      {state === 'idle' && idleAction === 'hum' && (
        <g className="pip-notes">
          <path className="pip-note pip-note-1" d="M120 48V36l8-2v11M120 48a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM128 45a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          <path className="pip-note pip-note-2" d="M38 40V30M38 40a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM38 30q4 1 5 5" />
        </g>
      )}
    </>
  );
}

/** Effects drawn in front of the body. */
function FrontDecor({ state }: { state: MascotState }) {
  return (
    <>
      {state === 'zoom' && (
        <g className="pip-sparkles">
          <path className="pip-sparkle pip-sparkle-2" d="M28 104l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6Z" />
          <path className="pip-sparkle pip-sparkle-3" d="M134 108l1.4 3.4 3.4 1.4-3.4 1.4-1.4 3.4-1.4-3.4-3.4-1.4 3.4-1.4Z" />
        </g>
      )}
      {(state === 'summoned' || state === 'excited' || state === 'present') && (
        <g className="pip-sparkles">
          <path className="pip-sparkle pip-sparkle-1" d="M30 50l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" />
          <path className="pip-sparkle pip-sparkle-2" d="M130 52l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6Z" />
          <path className="pip-sparkle pip-sparkle-3" d="M124 92l1.3 3.3 3.3 1.3-3.3 1.3-1.3 3.3-1.3-3.3-3.3-1.3 3.3-1.3Z" />
          <path className="pip-sparkle pip-sparkle-1" d="M36 100l1.3 3.3 3.3 1.3-3.3 1.3-1.3 3.3-1.3-3.3-3.3-1.3 3.3-1.3Z" />
        </g>
      )}
      {state === 'done' && (
        <g className="pip-confetti">
          {[[-38, -28, '#f2b33d'], [40, -32, '#2fb3b8'], [-50, 4, '#a678f0'], [48, 0, '#ff6fa4'], [-20, -46, '#5cc27a'], [22, -48, '#ec5a44'], [-44, -16, '#2fb3b8'], [44, -18, '#f2b33d'], [0, -52, '#a678f0'], [-30, 18, '#ff6fa4']].map(([dx, dy, color], index) => (
            <rect key={index} className="pip-confetti-piece" x="78" y="62" width="6" height="3" rx="1" fill={color as string} style={{ '--dx': `${dx}px`, '--dy': `${dy}px`, animationDelay: `${index * 40}ms` } as CSSProperties} />
          ))}
        </g>
      )}
      {state === 'laughing' && (
        <g className="pip-ha">
          <text className="pip-ha-1" x="112" y="40">ha</text>
          <text className="pip-ha-2" x="24" y="48">ha</text>
          <text className="pip-ha-3" x="122" y="66">ha!</text>
        </g>
      )}
      {state === 'love' && (
        <g className="pip-hearts">
          <path className="pip-float-heart pip-fh-1" d="M122 50c-4-2.7-6-4.7-6-7a3 3 0 0 1 6-1 3 3 0 0 1 6 1c0 2.3-2 4.3-6 7Z" />
          <path className="pip-float-heart pip-fh-2" d="M34 56c-3.4-2.3-5-4-5-6a2.5 2.5 0 0 1 5-.9 2.5 2.5 0 0 1 5 .9c0 2-1.6 3.7-5 6Z" />
          <path className="pip-float-heart pip-fh-3" d="M130 82c-3-2-4.4-3.5-4.4-5.2a2.2 2.2 0 0 1 4.4-.8 2.2 2.2 0 0 1 4.4.8c0 1.7-1.4 3.2-4.4 5.2Z" />
        </g>
      )}
      {state === 'sad' && <path className="pip-tear" d="M62 80c2 2.8 3 4.5 3 5.9a3 3 0 0 1-6 0c0-1.4 1-3.1 3-5.9Z" />}
      {state === 'error' && <path className="pip-sweat" d="M113 48c2.6 3.6 3.8 5.8 3.8 7.6a3.8 3.8 0 0 1-7.6 0c0-1.8 1.2-4 3.8-7.6Z" />}
      {state === 'dizzy' && (
        <g className="pip-orbit">
          <path d="M52 34l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6Z" fill="#f2b33d" />
          <path d="M108 30l1.4 3.4 3.4 1.4-3.4 1.4-1.4 3.4-1.4-3.4-3.4-1.4 3.4-1.4Z" fill="#2fb3b8" />
          <path d="M80 24l1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2Z" fill="#ff6fa4" />
        </g>
      )}
      {(state === 'held' || state === 'zoom') && <path className="pip-motion" d="M24 76h-8M26 88h-10M136 76h8M134 88h10" />}
      {state === 'shocked' && <path className="pip-shock" d="M34 30l-6-6M46 22l-2-8M114 22l2-8M126 30l6-6" />}
      {state === 'mischief' && <path className="pip-sparkle pip-sparkle-1" d="M126 50l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6Z" />}
    </>
  );
}

/** One hat or pair of glasses per chat theme, worn on the body so it moves with Pip. */
const PROP_SCALE: Record<BackdropId, { scale: number; ox: number; oy: number }> = {
  travel: { scale: 1.34, ox: 80, oy: 52 },
  study: { scale: 1.18, ox: 80, oy: 58 },
  build: { scale: 1.16, ox: 80, oy: 60 },
  food: { scale: 1.55, ox: 80, oy: 42 },
  outdoors: { scale: 1.5, ox: 80, oy: 44 },
  celebrate: { scale: 1.55, ox: 80, oy: 42 },
  chill: { scale: 1.48, ox: 80, oy: 44 },
};

function ThemeProp({ theme, state }: { theme: BackdropId | null; state: MascotState }) {
  if (!theme) return null;
  const { scale, ox, oy } = PROP_SCALE[theme];
  return (
    <g transform={`translate(${ox} ${oy}) scale(${scale}) translate(${-ox} ${-oy})`}>
      <g className={`pip-hat${state === 'shocked' || state === 'summoned' ? ' pip-hat-pop' : ''}${state === 'zoom' || state === 'excited' || state === 'done' ? ' pip-hat-wobble' : ''}`}>
        <ThemePropArt theme={theme} />
      </g>
    </g>
  );
}

function ThemePropArt({ theme }: { theme: BackdropId }) {
  switch (theme) {
    case 'travel':
      return (
        <g className="pip-prop">
          <path d="M71 49.4Q80 45.8 89 49.4" fill="none" stroke="#1f1b27" strokeWidth="2.4" />
          <path d="M54.5 46.5h18v6.4a5 5 0 0 1-5 5h-8a5 5 0 0 1-5-5Z" fill="#1f1b27" />
          <path d="M87.5 46.5h18v6.4a5 5 0 0 1-5 5h-8a5 5 0 0 1-5-5Z" fill="#1f1b27" />
          <path d="M58 49.5l5-.4M91 49.5l5-.4" stroke="#7fd8ff" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      );
    case 'study':
      return (
        <g className="pip-prop">
          <path d="M80 18 104 27 80 36 56 27Z" fill="#2c2a4a" />
          <path d="M66 31v7q14 6 28 0v-7" fill="#3a3760" />
          <path d="M104 27v12" stroke="#f2b33d" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="104" cy="40.5" r="2.4" fill="#f2b33d" />
          <circle cx="66" cy="70" r="11.4" fill="#ffffff" fillOpacity="0.16" stroke="#2c2a4a" strokeWidth="2.6" />
          <circle cx="94" cy="70" r="11.4" fill="#ffffff" fillOpacity="0.16" stroke="#2c2a4a" strokeWidth="2.6" />
          <path d="M77.2 68.4Q80 65.6 82.8 68.4" fill="none" stroke="#2c2a4a" strokeWidth="2.6" strokeLinecap="round" />
        </g>
      );
    case 'build':
      return (
        <g className="pip-prop">
          <path d="M48 58Q48 25 80 25Q112 25 112 58" fill="none" stroke="#2d2a35" strokeWidth="5" strokeLinecap="round" />
          <rect x="40.5" y="52" width="12" height="18" rx="5" fill="#2d2a35" />
          <rect x="107.5" y="52" width="12" height="18" rx="5" fill="#2d2a35" />
          <rect x="43" y="55" width="7" height="12" rx="3" fill="#a678f0" />
          <rect x="110" y="55" width="7" height="12" rx="3" fill="#a678f0" />
          <path d="M47 69Q48.5 88 67 91" fill="none" stroke="#2d2a35" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="68.5" cy="91" r="3.4" fill="#2d2a35" />
        </g>
      );
    case 'food':
      return (
        <g className="pip-prop">
          <circle cx="66" cy="25" r="8.5" fill="#fff" stroke="#d9d0cc" strokeWidth="1.4" />
          <circle cx="94" cy="25" r="8.5" fill="#fff" stroke="#d9d0cc" strokeWidth="1.4" />
          <circle cx="80" cy="19" r="11" fill="#fff" stroke="#d9d0cc" strokeWidth="1.4" />
          <rect x="62" y="29" width="36" height="14" rx="3" fill="#fff" stroke="#d9d0cc" strokeWidth="1.4" />
          <path d="M71 32.5v7M80 32.5v7M89 32.5v7" stroke="#e8dfdb" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );
    case 'outdoors':
      return (
        <g className="pip-prop">
          <path d="M60 44Q61 23 80 23Q99 23 100 44Z" fill="#6f9c4f" />
          <path d="M60.5 38.5h39" stroke="#e9c46a" strokeWidth="3.4" />
          <path d="M45 45Q80 34 115 45Q80 54 45 45Z" fill="#557f3c" />
          <path d="M88 26q5 4 3 11" fill="none" stroke="#557f3c" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );
    case 'celebrate':
      return (
        <g className="pip-prop" transform="rotate(-14 80 42)">
          <path d="M65 42L80 4L95 42Q80 47 65 42Z" fill="#ff6fa4" />
          <path d="M70 31Q80 33.4 90 31M74.6 19.5Q80 21 85.4 19.5" fill="none" stroke="#f2b33d" strokeWidth="3.4" strokeLinecap="round" />
          <circle cx="80" cy="4" r="5.4" fill="#f2b33d" />
        </g>
      );
    case 'chill':
      return (
        <g className="pip-prop">
          <path d="M58 46Q58 26 80 26Q102 26 102 46Z" fill="#2fb3b8" />
          <path d="M56 42h48v6.5H56Z" fill="#23959a" />
          <path d="M66 31v10M74 28v13M82 27.5v13.5M90 28v13M97 31.5v9.5" stroke="#5fd0d4" strokeWidth="1.6" />
          <circle cx="80" cy="24.5" r="5" fill="#f2b33d" />
        </g>
      );
  }
}

/** Three balls Pip juggles during an idle action. */
function JuggleBalls() {
  return (
    <g className="pip-juggle">
      <circle className="pip-ball pip-ball-1" r="2.6" fill="#f2b33d" />
      <circle className="pip-ball pip-ball-2" r="2.6" fill="#2fb3b8" />
      <circle className="pip-ball pip-ball-3" r="2.6" fill="#a678f0" />
    </g>
  );
}

/** A small item Pip holds, per theme. Drawn around (0, 0), the hand. */
function HeldItem({ theme }: { theme: BackdropId }) {
  switch (theme) {
    case 'travel':
      return <g className="pip-held"><rect x="-7" y="1" width="14" height="11" rx="2.4" fill="#d08a45" /><path d="M-3 1v-3h6v3" fill="none" stroke="#8a5525" strokeWidth="1.6" /><path d="M-7 5.5h14" stroke="#f6e3b8" strokeWidth="1.6" /><path d="M-3 1v11M3 1v11" stroke="#a96a31" strokeWidth="1" /></g>;
    case 'study':
      return <g className="pip-held"><path d="M-8-2l8 2 8-2v12l-8 2-8-2Z" fill="#5b6cf0" /><path d="M0 0v12" stroke="#fff" strokeWidth="1.2" /><path d="M-6 1.6l5 1.2M1 2.8l5-1.2" stroke="#c8cffb" strokeWidth="1" /></g>;
    case 'build':
      return <g className="pip-held"><rect x="-8" y="-9" width="16" height="11" rx="1.8" fill="#2d2a35" /><rect x="-6.4" y="-7.4" width="12.8" height="7.8" rx="1" fill="#a678f0" /><path d="M-4-4.4l2 1.4-2 1.4M0-1.6h3" fill="none" stroke="#fff" strokeWidth="1" strokeLinecap="round" /><path d="M-10 2.5h20" stroke="#47434f" strokeWidth="2.4" strokeLinecap="round" /></g>;
    case 'food':
      return <g className="pip-held"><path d="M0 2v14" stroke="#b9b4bd" strokeWidth="2" strokeLinecap="round" /><path d="M-4-8v7a4 4 0 0 0 8 0v-7M0-8v7" fill="none" stroke="#b9b4bd" strokeWidth="1.8" strokeLinecap="round" /></g>;
    case 'outdoors':
      return <g className="pip-held"><path d="M0 4 12-18" stroke="#8a5a2b" strokeWidth="2" strokeLinecap="round" /><rect x="8" y="-26" width="8" height="9" rx="3" fill="#fffaf2" stroke="#e6d6bf" strokeWidth="1" transform="rotate(28 12 -21)" /><path d="M10-25.5q3-2 6 .5" fill="none" stroke="#c98a4b" strokeWidth="2" strokeLinecap="round" transform="rotate(28 12 -21)" /></g>;
    case 'celebrate':
      return <g className="pip-held"><path d="M-2 2 14-6v12Z" fill="#a678f0" /><path d="M-2 2l4-1.6M4-1l2 6" stroke="#f2b33d" strokeWidth="1.6" strokeLinecap="round" /><path className="pip-horn-curl" d="M14 0q6-4 6 2t-5 4" fill="none" stroke="#ff6fa4" strokeWidth="1.8" strokeLinecap="round" /></g>;
    case 'chill':
      return (
        <g className="pip-held">
          <path className="pip-steam" d="M-2-13q-2-3 0-5.5M2.5-13q-2-3 0-5.5" />
          <path d="M-6-9h10v8.5a3.6 3.6 0 0 1-3.6 3.6h-2.8A3.6 3.6 0 0 1-6-.5Z" fill="#fff8ef" stroke="#c9b9a6" strokeWidth="1.1" />
          <path d="M4-7.4h1.8a2.6 2.6 0 0 1 0 5.2H4" fill="none" stroke="#c9b9a6" strokeWidth="1.4" />
          <path d="M-6-5.6h10" stroke="#2fb3b8" strokeWidth="1.8" />
        </g>
      );
  }
}

export const Mascot = memo(MascotView);
