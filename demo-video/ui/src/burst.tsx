import { useLayoutEffect, useMemo, useRef } from 'react';

/**
 * A small party-popper burst of streamers and confetti, played once at a point.
 * Used when @Vibe is tagged in the composer. Skipped for reduced-motion users.
 */
const colors = [
  'oklch(66% 0.19 31)', // coral (brand)
  'oklch(80% 0.15 78)', // amber
  'oklch(70% 0.12 195)', // teal
  'oklch(64% 0.17 300)', // violet
  'oklch(72% 0.16 350)', // pink
  'oklch(72% 0.15 145)', // green
];

type Shape = 'streamer' | 'chip' | 'dot' | 'tri';
const shapes: Shape[] = ['streamer', 'streamer', 'chip', 'dot', 'tri', 'streamer', 'chip', 'dot'];

interface Particle {
  shape: Shape;
  color: string;
  dx: number;
  dy: number;
  spin: number;
  duration: number;
  delay: number;
}

function makeParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, index) => {
    // Fan upward and to the sides, evenly spread with a little jitter.
    const angle = (-170 + (160 * index) / (count - 1) + (Math.random() * 14 - 7)) * (Math.PI / 180);
    const distance = 48 + Math.random() * 56;
    return {
      shape: shapes[index % shapes.length],
      color: colors[index % colors.length],
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      spin: (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 260),
      duration: 1300 + Math.random() * 600,
      delay: Math.random() * 120,
    };
  });
}

function ParticleShape({ shape, color }: { shape: Shape; color: string }) {
  if (shape === 'streamer') {
    return <svg width="10" height="23" viewBox="0 0 7 16"><path d="M3.5 1c2.6 2.2-2.6 4.2 0 7s-2.6 4.8 0 7" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" /></svg>;
  }
  if (shape === 'chip') return <span style={{ display: 'block', width: 10, height: 5, borderRadius: 2, background: color }} />;
  if (shape === 'tri') return <svg width="10" height="10" viewBox="0 0 7 7"><path d="M3.5 0.8 6.4 6.2H0.6Z" fill={color} /></svg>;
  return <span style={{ display: 'block', width: 7, height: 7, borderRadius: '50%', background: color }} />;
}

export function ConfettiBurst({ x, y, count = 24, onDone }: { x: number; y: number; count?: number; onDone?: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const particles = useMemo(() => makeParticles(count), [count]);

  useLayoutEffect(() => {
    const element = root.current;
    if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animations: Animation[] = [];
    element.querySelectorAll<HTMLElement>('[data-particle]').forEach((node, index) => {
      const particle = particles[index];
      animations.push(node.animate([
        { transform: 'translate(-50%, -50%) translate(0, 0) rotate(0deg) scale(0.3)', opacity: 1 },
        { transform: `translate(-50%, -50%) translate(${particle.dx}px, ${particle.dy}px) rotate(${particle.spin * 0.6}deg) scale(1)`, opacity: 1, offset: 0.55 },
        { transform: `translate(-50%, -50%) translate(${particle.dx * 1.2}px, ${particle.dy + 46}px) rotate(${particle.spin}deg) scale(0.85)`, opacity: 0 },
      ], { duration: particle.duration, delay: particle.delay, easing: 'cubic-bezier(0.18, 0.85, 0.32, 1)', fill: 'both' }));
    });
    const ring = element.querySelector<HTMLElement>('[data-ring]');
    if (ring) {
      animations.push(ring.animate([
        { transform: 'translate(-50%, -50%) scale(0.2)', opacity: 0.9 },
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 0 },
      ], { duration: 850, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'both' }));
    }
    const timer = onDone ? window.setTimeout(onDone, 2_200) : 0;
    return () => { window.clearTimeout(timer); animations.forEach((animation) => animation.cancel()); };
  }, [particles]);

  return (
    <div ref={root} className="confetti-burst" style={{ left: x, top: y }} aria-hidden="true">
      <span data-ring className="confetti-ring" />
      {particles.map((particle, index) => (
        <span key={index} data-particle className="confetti-particle"><ParticleShape shape={particle.shape} color={particle.color} /></span>
      ))}
    </div>
  );
}
