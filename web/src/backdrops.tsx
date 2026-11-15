import { useId, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import type { Party } from '@vibe/shared';

/**
 * Minimal line-drawn chat backgrounds. Each party gets one automatically from its
 * name and goal; a member can override it locally from the party details panel.
 * Every theme is built from four 24×24 icons, so the same drawings make the
 * tiled background, the sidebar thumbnail and the empty-chat illustration.
 */
export type BackdropId = 'travel' | 'study' | 'build' | 'food' | 'outdoors' | 'celebrate' | 'chill';

interface BackdropDefinition {
  id: BackdropId;
  label: string;
  hue: number;
  keywords: string[];
  icons: [ReactNode, ReactNode, ReactNode, ReactNode];
}

const p = (d: string) => <path d={d} />;

export const backdrops: BackdropDefinition[] = [
  {
    id: 'travel',
    label: 'Travel',
    hue: 220,
    keywords: ['trip', 'travel', 'vacation', 'flight', 'beach', 'road', 'roadtrip', 'weekend', 'getaway', 'visit', 'tour', 'hotel', 'airbnb', 'cruise', 'abroad', 'spring break', 'san diego', 'vegas', 'europe', 'japan', 'mexico', 'city'],
    icons: [
      p('M3 11.5 20.5 4l-6 16.5-3.2-6.8L3 11.5Z M11.3 13.7 20.5 4'),
      p('M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z M12 12.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z'),
      p('M5 8.5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z M9 8.5V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2.5 M9 12v4 M15 12v4'),
      p('M2.5 14.5c2.4-3 4.8-3 7.2 0s4.8 3 7.2 0 3.5-2.4 4.6-1.2 M2.5 9.5c2.4-3 4.8-3 7.2 0s4.8 3 7.2 0'),
    ],
  },
  {
    id: 'study',
    label: 'Studies',
    hue: 268,
    keywords: ['class', 'classes', 'course', 'study', 'studying', 'exam', 'midterm', 'final', 'homework', 'hw', 'semester', 'lecture', 'professor', 'prof', 'asu', 'cse', 'math', 'physics', 'chem', 'biology', 'schedule', 'syllabus', 'quiz', 'assignment', 'school', 'college', 'university', 'notes', 'learn', 'research'],
    icons: [
      p('M3 5.6c3-1.2 6-1 9 1 3-2 6-2.2 9-1v13c-3-1.2-6-1-9 1-3-2-6-2.2-9-1v-13Z M12 6.6v13'),
      p('M2.5 9 12 4.5 21.5 9 12 13.5 2.5 9Z M6.5 11v4.8c3 2.4 8 2.4 11 0V11 M21.5 9v5'),
      p('M4.5 19.5l1-4.6L15.8 4.6a2 2 0 0 1 2.8 0l.8.8a2 2 0 0 1 0 2.8L9.1 18.5l-4.6 1Z M14 6.5l3.5 3.5'),
      p('M9.5 18h5 M10.5 21h3 M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3Z'),
    ],
  },
  {
    id: 'build',
    label: 'Building',
    hue: 305,
    keywords: ['hack', 'hackathon', 'project', 'code', 'coding', 'build', 'app', 'startup', 'demo', 'devpost', 'sunhacks', 'design', 'prototype', 'launch', 'team', 'idea', 'ideas', 'brainstorm', 'product', 'software', 'ai', 'ml', 'work', 'meeting', 'sprint'],
    icons: [
      p('M8 7.5 3.5 12 8 16.5 M16 7.5l4.5 4.5-4.5 4.5 M13.8 4.5l-3.6 15'),
      p('M5 5.5h14a1 1 0 0 1 1 1V16H4V6.5a1 1 0 0 1 1-1Z M2 19.5h20'),
      p('M13.5 2.5 5 13.5h6.5l-1 8 8.5-11h-6.5l1-8Z'),
      p('M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9L12 3.5Z M18.5 16v4 M16.5 18h4'),
    ],
  },
  {
    id: 'food',
    label: 'Food',
    hue: 42,
    keywords: ['food', 'dinner', 'lunch', 'breakfast', 'brunch', 'restaurant', 'cook', 'cooking', 'recipe', 'eat', 'eating', 'meal', 'snack', 'pizza', 'coffee', 'cafe', 'boba', 'tacos', 'sushi', 'bbq', 'potluck', 'grocery', 'bake'],
    icons: [
      p('M3 11.5h18a9 9 0 0 1-18 0Z M8.5 8c-.8-1.2.8-2.3 0-3.5 M12 8c-.8-1.2.8-2.3 0-3.5 M15.5 8c-.8-1.2.8-2.3 0-3.5'),
      p('M4 8h12.5v5.5A5.5 5.5 0 0 1 11 19H9.5A5.5 5.5 0 0 1 4 13.5V8Z M16.5 10h1.8a2.6 2.6 0 0 1 0 5.2h-2.1 M7 4.5c-.5-.8.5-1.5 0-2.3 M11 4.5c-.5-.8.5-1.5 0-2.3'),
      p('M12 21.5 3.5 6c5.5-3 11.5-3 17 0L12 21.5Z M5.3 9.2c4.4-2 9-2 13.4 0 M10 12.5h.01 M14 15h.01 M12.5 10.5h.01'),
      p('M7 3v6.5a2 2 0 0 0 4 0V3 M9 3v18 M17 3c-2.2 2.2-2.2 7.6 0 9.6V21'),
    ],
  },
  {
    id: 'outdoors',
    label: 'Outdoors',
    hue: 150,
    keywords: ['camp', 'camping', 'hike', 'hiking', 'trail', 'outdoor', 'outdoors', 'park', 'national park', 'mountain', 'lake', 'gym', 'workout', 'fitness', 'run', 'running', 'soccer', 'basketball', 'sport', 'sports', 'bike', 'climb', 'climbing', 'ski', 'surf', 'picnic', 'garden', 'sedona'],
    icons: [
      p('M2 20 9 8l4.2 6.5 2.8-3.8L22 20H2Z'),
      p('M3 20.5 12 5l9 15.5H3Z M12 5v15.5 M9 20.5l3-5 3 5'),
      p('M12 2.5 17.5 10h-3l4 6.5h-13l4-6.5h-3L12 2.5Z M12 16.5v5'),
      p('M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z M12 2v2.2 M12 19.8V22 M4.9 4.9l1.6 1.6 M17.5 17.5l1.6 1.6 M2 12h2.2 M19.8 12H22 M4.9 19.1l1.6-1.6 M17.5 6.5l1.6-1.6'),
    ],
  },
  {
    id: 'celebrate',
    label: 'Celebration',
    hue: 352,
    keywords: ['party', 'birthday', 'bday', 'celebrate', 'celebration', 'concert', 'music', 'festival', 'event', 'wedding', 'game night', 'movie', 'movies', 'show', 'club', 'dance', 'friends', 'hangout', 'graduation', 'halloween', 'christmas', 'new year', 'gift'],
    icons: [
      p('M9 18V5.5l11-2V16 M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z M20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z'),
      p('M12 3a6 6 0 0 0-6 6c0 4 3 7.5 6 7.5s6-3.5 6-7.5a6 6 0 0 0-6-6Z M11 16.5l1-.1 1 .1-1 2-1-2Z M12 18.5c0 1.6-1.6 1.7-1.6 3'),
      p('M12 3.5l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.5l-5.1 2.7 1-5.7-4.1-4 5.7-.8L12 3.5Z'),
      p('M4 8h16v4H4V8Z M5.5 12v8.5h13V12 M12 8v12.5 M12 8C9.5 8 7.5 6.8 8 5c.6-2 3.2-.6 4 3 .8-3.6 3.4-5 4-3 .5 1.8-1.5 3-4 3Z'),
    ],
  },
  {
    id: 'chill',
    label: 'Everyday',
    hue: 192,
    keywords: [],
    icons: [
      p('M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-5 4v-4.5A1.5 1.5 0 0 1 3.5 15V6A1.5 1.5 0 0 1 5 4.5Z'),
      p('M12 20s-7.5-4.6-7.5-10.2a4.2 4.2 0 0 1 7.5-2.6 4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z'),
      p('M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M8.3 14c2 2.1 5.4 2.1 7.4 0 M9 9.5h.01 M15 9.5h.01'),
      p('M3.5 11 12 3.5l8.5 7.5 M5.5 9.5V20h13V9.5 M10 20v-5.5h4V20'),
    ],
  },
];

const byId = new Map(backdrops.map((item) => [item.id, item]));
export const getBackdrop = (id: BackdropId) => byId.get(id)!;

export function pickBackdrop(text: string): BackdropId {
  const haystack = ` ${text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ')} `;
  let best: BackdropId = 'chill';
  let bestScore = 0;
  for (const item of backdrops) {
    let score = 0;
    for (const word of item.keywords) {
      if (haystack.includes(` ${word} `) || haystack.includes(` ${word}s `)) score += word.includes(' ') ? 2 : 1;
    }
    if (score > bestScore) {
      best = item.id;
      bestScore = score;
    }
  }
  return best;
}

const overrideKey = (partyId: string) => `vibe.backdrop.${partyId}`;
const listeners = new Set<() => void>();

function readOverride(partyId: string): BackdropId | null {
  try {
    const value = localStorage.getItem(overrideKey(partyId));
    return value && byId.has(value as BackdropId) ? value as BackdropId : null;
  } catch {
    return null;
  }
}

export function setBackdropOverride(partyId: string, value: BackdropId | null) {
  try {
    if (value) localStorage.setItem(overrideKey(partyId), value);
    else localStorage.removeItem(overrideKey(partyId));
  } catch {
    /* storage unavailable; keep automatic choice */
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Returns the backdrop in effect for a party plus whether it was chosen automatically. */
export function usePartyBackdrop(party: Pick<Party, 'id' | 'name' | 'goal'>) {
  const override = useSyncExternalStore(subscribe, () => readOverride(party.id), () => null);
  const automatic = pickBackdrop(`${party.name} ${party.goal}`);
  const id = override ?? automatic;
  return { definition: byId.get(id)!, automatic, isAutomatic: !override };
}

export function backdropStyle(id: BackdropId): CSSProperties {
  return { '--party-hue': byId.get(id)!.hue } as CSSProperties;
}

/* Icon placements inside one 300×300 tile: x, y, scale, rotation. Offset rows keep the repeat from looking like a grid. */
const placements: Array<[number, number, number, number]> = [
  [26, 28, 1.75, -12],
  [168, 52, 1.5, 10],
  [78, 168, 1.6, 8],
  [216, 196, 1.8, -10],
];
const dots: Array<[number, number, number]> = [[140, 140, 2.2], [262, 122, 1.7], [34, 262, 1.7], [136, 268, 1.5], [254, 22, 1.5]];

function Glyph({ children, x, y, scale, rotate }: { children: ReactNode; x: number; y: number; scale: number; rotate: number }) {
  return <g transform={`translate(${x} ${y}) rotate(${rotate} ${12 * scale} ${12 * scale}) scale(${scale})`}>{children}</g>;
}

export function PartyBackdrop({ id }: { id: BackdropId }) {
  const patternId = useId().replace(/:/g, '');
  const definition = byId.get(id)!;
  return (
    <div className="party-backdrop" style={backdropStyle(id)} aria-hidden="true">
      <svg className="party-backdrop-art" width="100%" height="100%">
        <defs>
          <pattern id={patternId} width="300" height="300" patternUnits="userSpaceOnUse">
            <g className="bd-stroke">
              {definition.icons.map((icon, index) => {
                const [x, y, scale, rotate] = placements[index];
                return <Glyph key={index} x={x} y={y} scale={scale} rotate={rotate}>{icon}</Glyph>;
              })}
            </g>
            {dots.map(([cx, cy, r]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} className="bd-fill" />)}
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
    </div>
  );
}

/** A theme thumbnail: the theme's first icon, centred on its tinted tile. */
export function BackdropSwatch({ id, size = 28 }: { id: BackdropId; size?: number }) {
  const definition = byId.get(id)!;
  return (
    <span className="backdrop-swatch" style={{ ...backdropStyle(id), width: size, height: size }} aria-hidden="true">
      <svg width={Math.round(size * 0.6)} height={Math.round(size * 0.6)} viewBox="0 0 24 24" className="bd-icon">{definition.icons[0]}</svg>
    </span>
  );
}

/** Larger centred illustration for an empty chat: three of the theme's icons on a soft tile. */
export function BackdropIllustration({ id }: { id: BackdropId }) {
  const definition = byId.get(id)!;
  return (
    <span className="backdrop-illustration" style={backdropStyle(id)} aria-hidden="true">
      <svg viewBox="0 0 96 96" width="96" height="96">
        <g className="bd-icon bd-icon-soft"><g transform="translate(8 50) rotate(-12 12 12)">{definition.icons[1]}</g></g>
        <g className="bd-icon bd-icon-soft"><g transform="translate(64 48) rotate(12 12 12)">{definition.icons[2]}</g></g>
        <g className="bd-icon bd-icon-main"><g transform="translate(27 18) scale(1.75)">{definition.icons[0]}</g></g>
      </svg>
    </span>
  );
}
