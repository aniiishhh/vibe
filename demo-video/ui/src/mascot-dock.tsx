import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import type { AgentRun, Message } from '@vibe/shared';
import type { BackdropId } from './backdrops';
import { Mascot, type MascotState } from './mascot';
import { ConfettiBurst } from './burst';

import { usePipEnabled } from './pip-settings';
const positionKey = 'vibe.pip.position';

// Demo clone: the capture page can shorten Pip's 45 s nap timer so a nap fits in one take.
const SLEEP_AFTER_MS = Number(new URLSearchParams(window.location.search).get('sleepMs') ?? 45_000);
const BUBBLE_GAP_MS = 3_500;

const lines: Partial<Record<MascotState, string[]>> = {
  wave: ['Hey there!', 'Hi friends!', 'Welcome back!'],
  summoned: ['You rang?', 'Ooh, a question!', 'Ready when you are'],
  done: ['Done!', 'Ta-da!', 'There you go'],
  error: ['Oops, that didn’t work', 'Hmm, I tripped'],
  laughing: ['Haha!', 'LOL', 'That’s funny'],
  love: ['Aww', 'Love that', 'So sweet'],
  sad: ['Sending hugs', 'Oh no', 'I’m here for you'],
  excited: ['Woo!', 'Let’s go!', 'Yesss'],
  curious: ['Hmm?', 'Good question', 'Ooh, tell me more'],
  reading: ['Reading…', 'Oh nice', 'Interesting'],
  held: ['Wheee!', 'Where are we going?', 'Whoa, up we go'],
  dizzy: ['Whoa…', 'The room is spinning', 'Nice spot'],
  mischief: ['Hehe', 'Sneaky sneaky', 'Don’t mind me'],
  present: ['Fresh answer, right here!', 'Ta-da! Read this one', 'Hot off the press!', 'Special delivery!'],
  shocked: ['Whoa!', 'No way!', 'Wait, what?!'],
};
const FLY_MS = 750;
const PRESENT_MS = 1_900;
const PRESENT_TOTAL_MS = FLY_MS * 2 + PRESENT_MS;
const PRESENT_COOLDOWN_MS = 20_000;
const trailColors = ['#ec5a44', '#f2b33d', '#2fb3b8', '#a678f0', '#ff6fa4', '#5cc27a'];
const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

/** Reads the mood of a piece of text with a few simple patterns; runs only in this browser. */
export function moodOf(text: string): MascotState | null {
  const value = text.trim();
  if (!value) return null;
  if (/\b(no way|wtf|omg what|seriously\?|whoa)\b|😱|😮|😳|\?!|!\?/iu.test(value)) return 'shocked';
  if (/\b(ha(ha)+|lol+|lmao|rofl|hehe+|xd)\b|😂|🤣|😆|😹/iu.test(value)) return 'laughing';
  if (/\b(love|loved|adore|yay|awesome|amazing|cute|perfect|thank you|thanks)\b|❤|♥|<3|😍|🥰|🙏/iu.test(value)) return 'love';
  if (/\b(sad|ugh|sorry|tired|stressed|cry|crying|upset|miss|sick|rip|bad news|worried)\b|😢|😭|☹|:\(/iu.test(value)) return 'sad';
  if (/!{2,}|\b(wow|omg|let'?s go|woo+|hype|can'?t wait|yes+)\b|🎉|🔥|🤩/iu.test(value) || /!\s*$/.test(value)) return 'excited';
  if (/\?\s*$/.test(value)) return 'curious';
  return null;
}

interface Flash { state: MascotState; ms: number; line?: boolean }
interface Position { x: number; y: number }

/**
 * Pip, living inside the chat. It can be dragged anywhere in the conversation
 * area (position is remembered on this device), and reacts using signals the
 * page already has: keystrokes, the mood of the draft and of new messages,
 * @Vibe mentions, reply status and idle time.
 */
export function MascotDock({ containerRef, composerRef, composerInputRef, runs, draft, messages, currentUserId, theme }: {
  containerRef: RefObject<HTMLElement | null>;
  composerRef: RefObject<HTMLElement | null>;
  composerInputRef?: RefObject<HTMLTextAreaElement | null>;
  runs: AgentRun[];
  draft: string;
  messages: Message[];
  currentUserId: string;
  theme: BackdropId;
}) {
  const enabled = usePipEnabled();
  const [size, setSize] = useState(168);
  const [position, setPosition] = useState<Position | null>(null);
  const [dragging, setDragging] = useState(false);
  const [swing, setSwing] = useState(0);
  const [queue, setQueue] = useState<Flash[]>([]);
  const [flash, setFlash] = useState<{ state: MascotState; until: number } | null>(null);
  const [bubble, setBubble] = useState<{ text: string; key: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const lastActivity = useRef(Date.now());
  const lastBubble = useRef(0);
  const seenRuns = useRef(new Map<string, AgentRun['status']>());
  const seenMessages = useRef<string | null>(null);
  const drag = useRef<{ id: number; startX: number; startY: number; originX: number; originY: number; moved: boolean; lastX: number } | null>(null);
  const dockRef = useRef<HTMLButtonElement>(null);
  const mentionedAt = useRef(0);
  const lastPresent = useRef(0);
  const flightFrame = useRef(0);
  const [zooming, setZooming] = useState(false);
  const [flightPhase, setFlightPhase] = useState<'go' | 'stay' | 'back' | null>(null);
  const [burst, setBurst] = useState<{ key: number; x: number; y: number } | null>(null);
  const presentTarget = useRef<string | null>(null);

  const say = useCallback((state: MascotState, force = false) => {
    const options = lines[state];
    if (!options) return;
    if (!force && Date.now() - lastBubble.current < BUBBLE_GAP_MS) return;
    lastBubble.current = Date.now();
    setBubble({ text: pick(options), key: Date.now() });
  }, []);

  const enqueue = useCallback((...items: Flash[]) => setQueue((current) => [...current, ...items]), []);

  // Play queued reactions one after another.
  useEffect(() => {
    if (flash && flash.until > now) return;
    if (queue.length === 0) { if (flash) setFlash(null); return; }
    const [next, ...rest] = queue;
    setQueue(rest);
    setFlash({ state: next.state, until: Date.now() + next.ms });
    if (next.line !== false) say(next.state);
  }, [queue, flash, now, say]);

  // Greet when the chat opens.
  useEffect(() => { enqueue({ state: 'wave', ms: 2_200 }); }, [enqueue]);

  // Reply status: celebrate, then read the reply; or wince at a failure.
  useEffect(() => {
    for (const run of runs) {
      const before = seenRuns.current.get(run.id);
      if (before && before !== run.status) {
        if (run.status === 'completed') {
          const canPresent = Boolean(run.replyMessageId) && Date.now() - lastPresent.current > PRESENT_COOLDOWN_MS && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          if (canPresent) {
            lastPresent.current = Date.now();
            presentTarget.current = run.replyMessageId ?? null;
            enqueue({ state: 'done', ms: 1_100 }, { state: 'present', ms: PRESENT_TOTAL_MS, line: false }, { state: 'reading', ms: 2_000, line: false });
          } else {
            enqueue({ state: 'done', ms: 2_400 }, { state: 'reading', ms: 2_400, line: false });
          }
        }
        if (run.status === 'failed') enqueue({ state: 'error', ms: 4_500 });
        lastActivity.current = Date.now();
      }
      seenRuns.current.set(run.id, run.status);
    }
  }, [runs, enqueue]);

  // New messages: react to their mood. Ignore the history that was already there.
  useEffect(() => {
    const latest = messages[messages.length - 1];
    if (!latest) return;
    if (seenMessages.current === null) { seenMessages.current = latest.id; return; }
    if (latest.id === seenMessages.current) return;
    seenMessages.current = latest.id;
    lastActivity.current = Date.now();
    if (latest.role === 'assistant') return;
    const mood = moodOf(latest.text);
    if (latest.authorId === currentUserId) {
      if (mood) enqueue({ state: mood, ms: 2_400 });
    } else {
      enqueue({ state: mood ?? 'reading', ms: mood ? 2_600 : 2_000 });
    }
  }, [messages, currentUserId, enqueue]);

  const mentioned = /@vibe(?![\p{L}\p{N}_])/iu.test(draft);
  const draftMood = moodOf(draft);
  useEffect(() => {
    if (mentioned) { mentionedAt.current = Date.now(); say('summoned', true); }
  }, [mentioned, say]);
  const lastMood = useRef<MascotState | null>(null);
  useEffect(() => {
    if (draftMood && draftMood !== lastMood.current) say(draftMood);
    lastMood.current = draftMood;
  }, [draftMood, say]);

  // Each keystroke: a bob, and eyes on the caret.
  useEffect(() => { lastActivity.current = Date.now(); }, [draft]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => { if (!document.hidden) setNow(Date.now()); }, 700);
    return () => window.clearInterval(timer);
  }, [enabled]);

  /* ---------- Position ---------- */
  const place = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const box = container.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const nextSize = box.width < 640 ? 118 : 168;
    setSize(nextSize);
    const maxX = Math.max(0, box.width - nextSize);
    const maxY = Math.max(0, box.height - nextSize);
    let stored: { fx: number; fy: number } | null = null;
    try { stored = JSON.parse(localStorage.getItem(positionKey) ?? 'null'); } catch { stored = null; }
    if (stored && Number.isFinite(stored.fx) && Number.isFinite(stored.fy)) {
      setPosition({ x: clamp(stored.fx, 0, 1) * maxX, y: clamp(stored.fy, 0, 1) * maxY });
      return;
    }
    const composer = composerRef.current?.getBoundingClientRect();
    const top = composer ? composer.top - box.top - nextSize + 20 : maxY - 90;
    const right = composer ? composer.right - box.left - nextSize - 64 : maxX - 40;
    setPosition({ x: clamp(right, 0, maxX), y: clamp(top, 0, maxY) });
  }, [containerRef, composerRef]);

  useEffect(() => {
    if (!enabled) return;
    // Passive effects run after the parent chat attaches its DOM ref.
    place();
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => { if (!drag.current) place(); });
    observer.observe(container);
    return () => observer.disconnect();
  }, [place, containerRef, enabled]);

  const persist = (next: Position) => {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return;
    const maxX = Math.max(1, box.width - size);
    const maxY = Math.max(1, box.height - size);
    try { localStorage.setItem(positionKey, JSON.stringify({ fx: next.x / maxX, fy: next.y / maxY })); } catch { /* ignore */ }
  };

  const moveTo = (x: number, y: number) => {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return null;
    const next = { x: clamp(x, 0, Math.max(0, box.width - size)), y: clamp(y, 0, Math.max(0, box.height - size)) };
    setPosition(next);
    return next;
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!position || event.button !== 0 || zooming) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, originX: position.x, originY: position.y, moved: false, lastX: event.clientX };
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (!state.moved && Math.hypot(dx, dy) > 5) {
      state.moved = true;
      setDragging(true);
      say('held', true);
    }
    if (!state.moved) return;
    moveTo(state.originX + dx, state.originY + dy);
    const velocity = event.clientX - state.lastX;
    state.lastX = event.clientX;
    setSwing((current) => current * 0.6 + velocity * 0.4);
  };
  const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    drag.current = null;
    lastActivity.current = Date.now();
    if (state.moved) {
      setDragging(false);
      setSwing(0);
      if (position) persist(position);
      setQueue([]);
      setFlash({ state: 'dizzy', until: Date.now() + 1_800 });
      say('dizzy', true);
    } else {
      setQueue([]);
      const wasAsleep = currentState === 'sleeping';
      setFlash({ state: wasAsleep ? 'shocked' : pick(['laughing', 'love', 'excited', 'wave', 'mischief'] as MascotState[]), until: Date.now() + 1_800 });
      setBubble({ text: wasAsleep ? 'Huh? I’m awake!' : pick(['Hehe, that tickles', 'Hi! Tag @Vibe when you need me', 'Drag me anywhere you like']), key: Date.now() });
      lastBubble.current = Date.now();
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!position) return;
    const step = event.shiftKey ? 64 : 24;
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (!delta) return;
    event.preventDefault();
    const next = moveTo(position.x + delta[0], position.y + delta[1]);
    if (next) persist(next);
  };

  /* ---------- State ---------- */
  const active = runs.find((run) => run.status === 'queued' || run.status === 'thinking');
  let currentState: MascotState = 'idle';
  if (dragging) currentState = 'held';
  else if (flash && flash.until > now && !(draft.trim() && (flash.state === 'wave' || flash.state === 'reading'))) currentState = flash.state;
  else if (active) currentState = active.status === 'queued' ? 'thinking' : (Math.floor(now / 5_000) % 2 === 0 ? 'working' : 'thinking') as MascotState;
  else if (mentioned) currentState = now - mentionedAt.current < 1_600 ? 'summoned' : 'excited';
  else if (draftMood) currentState = draftMood;
  else if (draft.trim()) currentState = 'peek';
  else if (now - lastActivity.current > SLEEP_AFTER_MS) currentState = 'sleeping';
  const shownState: MascotState = currentState === 'present' ? (flightPhase === 'stay' ? 'present' : flightPhase ? 'zoom' : 'done') : currentState;

  // While someone types, Pip slides over to the message box and peeks over its edge at the caret.
  const lastPeek = useRef<Position | null>(null);
  const { peekAt, lookAt } = useMemo(() => {
    const container = containerRef.current?.getBoundingClientRect();
    const composer = composerRef.current?.getBoundingClientRect();
    if (!container || !composer || !draft.trim() || dragging) { lastPeek.current = null; return { peekAt: null, lookAt: null }; }
    const input = composerInputRef?.current;
    const caretOffset = input ? caretX(input) : Math.min(draft.length * 7.6, composer.width - 60);
    const caret = composer.left + 16 + caretOffset - container.left;
    const targetX = clamp(caret + 70 - size / 2, 0, container.width - size);
    const y = composer.top - container.top - size * 0.6;
    const previous = lastPeek.current;
    const next = previous && Math.abs(previous.x - targetX) < 36 && Math.abs(previous.y - y) < 4 ? previous : { x: targetX, y };
    lastPeek.current = next;
    return { peekAt: next, lookAt: { x: clamp((caret - (next.x + size / 2)) / 140, -1, 1), y: 1 } };
  }, [draft, dragging, size, containerRef, composerRef, composerInputRef]);

  // Presenting: fly in an arc to Vibe's new reply, show it off, fly home.
  useEffect(() => {
    if (currentState !== 'present' || zooming || !position) return;
    const dock = dockRef.current;
    const container = containerRef.current;
    const message = presentTarget.current ? document.getElementById(`message-${presentTarget.current}`) : null;
    const bubbleEl = message?.querySelector('.msg-bubble') as HTMLElement | null;
    if (!dock || !container || !bubbleEl) return;
    const box = container.getBoundingClientRect();
    const target = bubbleEl.getBoundingClientRect();
    if (target.bottom < box.top + 40 || target.top > box.bottom - 40) return;
    const maxX = Math.max(0, box.width - size);
    const maxY = Math.max(0, box.height - size);
    const spot = {
      x: clamp(target.right - box.left - size * 0.28, 0, maxX),
      y: clamp(target.top - box.top - size * 0.58, 0, maxY),
    };
    const home = position;
    const arc = (from: Position, to: Position, f: number) => {
      const control = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 110 };
      const a = 1 - f;
      return { x: a * a * from.x + 2 * a * f * control.x + f * f * to.x, y: a * a * from.y + 2 * a * f * control.y + f * f * to.y };
    };
    const ease = (f: number) => (f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2);
    setZooming(true);
    setFlightPhase('go');
    const start = performance.now();
    let lastX = home.x;
    let phase: 'go' | 'stay' | 'back' = 'go';
    const frame = (now: number) => {
      const elapsed = now - start;
      let point: Position;
      if (elapsed < FLY_MS) point = arc(home, spot, ease(elapsed / FLY_MS));
      else if (elapsed < FLY_MS + PRESENT_MS) {
        if (phase !== 'stay') {
          phase = 'stay';
          setFlightPhase('stay');
          say('present', true);
          setBurst({ key: Date.now(), x: target.right - box.left - 12, y: target.top - box.top + 6 });
          bubbleEl.classList.add('msg-presented');
          window.setTimeout(() => bubbleEl.classList.remove('msg-presented'), 2_200);
        }
        point = { x: spot.x, y: spot.y + Math.sin((elapsed - FLY_MS) / 160) * 3 };
      } else {
        if (phase !== 'back') { phase = 'back'; setFlightPhase('back'); }
        point = arc(spot, home, ease(Math.min(1, (elapsed - FLY_MS - PRESENT_MS) / FLY_MS)));
      }
      dock.style.transform = `translate(${point.x}px, ${point.y}px)`;
      const velocity = point.x - lastX;
      lastX = point.x;
      setSwing((current) => current * 0.5 + velocity * 0.5);
      if (elapsed < PRESENT_TOTAL_MS) flightFrame.current = requestAnimationFrame(frame);
      else {
        dock.style.transform = `translate(${home.x}px, ${home.y}px)`;
        setSwing(0);
        setZooming(false);
        setFlightPhase(null);
      }
    };
    flightFrame.current = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(flightFrame.current);
      dock.style.transform = `translate(${home.x}px, ${home.y}px)`;
      bubbleEl.classList.remove('msg-presented');
      setZooming(false);
      setFlightPhase(null);
    };
    // Runs once per presenting flash.
  }, [currentState === 'present']);

  if (!enabled || !position) return null;
  const containerWidth = containerRef.current?.clientWidth ?? 800;
  const estimatedWidth = Math.min(250, (bubble?.text.length ?? 0) * 10 + 34);
  const spot = !zooming && peekAt && !dragging ? peekAt : position;
  const centre = spot.x + size / 2;
  const leftEdge = centre - estimatedWidth / 2;
  const rightEdge = centre + estimatedWidth / 2;
  const shift = leftEdge < 8 ? 8 - leftEdge : rightEdge > containerWidth - 8 ? containerWidth - 8 - rightEdge : 0;
  const below = spot.y < 70;
  return (
    <>
      <button
        ref={dockRef}
        type="button"
        className={`pip-dock${dragging ? ' pip-dock-dragging' : ''}${zooming ? ' pip-dock-zooming' : ''}${!dragging && !zooming ? ' pip-dock-gliding' : ''}${peekAt && !zooming && !dragging ? ' pip-dock-peeking' : ''}`}
        style={{ transform: `translate(${spot.x}px, ${spot.y}px)` }}
        aria-label="Pip, Vibe’s mascot. Click to poke, drag or use the arrow keys to move"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        {bubble && !zooming && <SpeechBalloon key={bubble.key} text={bubble.text} below={below} shift={shift} onDone={() => setBubble(null)} />}
        <Mascot state={shownState} theme={theme} size={size} lookAt={lookAt} pulse={draft.length} swing={swing} />
      </button>
      {burst && <ConfettiBurst key={burst.key} x={burst.x} y={burst.y} count={30} onDone={() => setBurst(null)} />}
    </>
  );
}

function clamp(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, value));
}

/** Pip's comic speech balloon: types its line out, holds, then pops away. */
function SpeechBalloon({ text, below, shift, onDone }: { text: string; below: boolean; shift: number; onDone: () => void }) {
  const [shown, setShown] = useState(0);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) setShown(text.length);
    const typing = reduce ? 0 : window.setInterval(() => setShown((count) => {
      if (count >= text.length) { window.clearInterval(typing); return count; }
      return count + 1;
    }), 34);
    const hold = 1_700 + text.length * 34;
    const leave = window.setTimeout(() => setLeaving(true), hold);
    const done = window.setTimeout(onDone, hold + 260);
    return () => { window.clearInterval(typing); window.clearTimeout(leave); window.clearTimeout(done); };
  }, [text]);
  const tilt = ((text.length * 7) % 5) - 2.5;
  return (
    <span
      className={`pip-say${below ? ' pip-say-below' : ''}${leaving ? ' pip-say-leaving' : ''}`}
      style={{ '--shift': `calc(-50% + ${shift}px)`, '--tail': `${-shift}px`, '--tilt': `${tilt}deg`, transform: `translateX(calc(-50% + ${shift}px)) rotate(${tilt}deg)` } as CSSProperties}
      role="status"
    >
      <span aria-hidden="true">{text.slice(0, shown)}{shown < text.length && <span className="pip-say-caret" />}</span>
      <span className="sr-only">{text}</span>
    </span>
  );
}

/** Horizontal caret offset inside a textarea, measured with a mirror span. */
function caretX(input: HTMLTextAreaElement) {
  const style = window.getComputedStyle(input);
  const before = input.value.slice(0, input.selectionStart ?? input.value.length);
  const line = before.split('\n').pop() ?? '';
  const canvas = caretX.canvas ?? (caretX.canvas = document.createElement('canvas'));
  const context = canvas.getContext('2d');
  if (!context) return line.length * 7.6;
  context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const width = context.measureText(line).width;
  return width % Math.max(1, input.clientWidth - 8);
}
caretX.canvas = null as HTMLCanvasElement | null;
