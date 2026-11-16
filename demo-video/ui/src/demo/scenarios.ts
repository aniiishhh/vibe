/* Demo data for the video. All people, ratings, seats and forecasts are illustrative. */
import type { Member, MemoryFact, Message, Party, PartyFact, PartyTask, TaskInput } from '@vibe/shared';

export const ME = 'u-maya';
export const PEOPLE: Record<string, string> = {
  'u-maya': 'Maya',
  'u-jordan': 'Jordan',
  'u-priya': 'Priya',
  'u-leo': 'Leo',
};

export interface ReplySpec {
  text: string;
  citations?: string[];
  warnings?: string[];
  thinkMs?: number;
  task?: TaskInput & { status?: PartyTask['status'] };
  facts?: Array<{ text: string; kind: PartyFact['kind'] }>;
}

export const CLASS_ID = 'p-class';
export const TRIP_ID = 'p-trip';

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export function makeParty(id: string, name: string, goal: string, theme: Party['theme'], minutes: number): Party {
  return { id, name, goal, ownerId: ME, createdAt: ago(minutes), mode: 'friendly', settingsVersion: 1, theme, themeSource: 'model' };
}

export function makeMembers(sharing: boolean): Member[] {
  return Object.entries(PEOPLE).map(([userId, name], index) => ({
    userId, name, joinedAt: ago(400 - index), role: userId === ME ? 'owner' : 'member', useSharedMemory: userId === ME ? sharing : false,
  }));
}

/** Chatter that opens the class party. The first Maya line is what Supermemory later learns from. */
export const CLASS_CHATTER: Array<[string, string]> = [
  ['u-leo', 'ok which 500-level CSE class are we doing together??'],
  ['u-jordan', 'something with a group project pls, I need a team'],
  ['u-maya', 'anything but 8ams 😭 also I’m vegetarian so no dining hall study sessions lol'],
  ['u-priya', 'lol fair. I just want one that isn’t brutal'],
  ['u-leo', 'wait do we even know who’s teaching it'],
];

export const TRIP_CHATTER: Array<[string, string]> = [
  ['u-priya', 'Sedona or Flagstaff this Saturday??'],
  ['u-leo', 'isn’t it gonna be too hot to hike'],
  ['u-maya', 'I’m down for either, just want good views'],
];

export function chatterMessages(partyId: string, lines: Array<[string, string]>, firstId: number, minutesAgo: number): Message[] {
  return lines.map(([authorId, text], index) => ({
    id: `m-${String(firstId + index).padStart(5, '0')}`,
    partyId, authorId, authorName: PEOPLE[authorId], role: 'user', text,
    createdAt: ago(minutesAgo - index * 0.4),
  }));
}

/** The id of Maya's "I'm vegetarian" line in the class chatter (seeded from id 10). */
export const VEGETARIAN_MESSAGE_ID = 'm-00012';

const catalog = (query: string) => `https://catalog.apps.asu.edu/catalog/classes/classlist?term=2271&${query}`;

export const REPLIES: Array<{ match: RegExp; reply: ReplySpec }> = [
  {
    match: /open for spring|classes are open/i,
    reply: {
      thinkMs: 5200,
      text: `Here are open **500-level CSE** classes for **Spring 2027** in Tempe, from the ASU class catalog:

| Course | Title | Days & time | Open seats |
|---|---|---|---|
| CSE 511 | Data Processing at Scale | Tue/Thu 10:30–11:45 | 18 |
| CSE 511 | Data Processing at Scale | Mon/Wed 8:00–9:15 | 26 |
| CSE 534 | Advanced Computer Networks | Mon/Wed 1:30–2:45 | 9 |
| CSE 575 | Statistical Machine Learning | Tue/Thu 3:00–4:15 | 4 |

**CSE 511** has a team project and the most room for a group of four.`,
      citations: [catalog('subject=CSE&catalogNbr=511'), catalog('subject=CSE&level=500'), catalog('subject=CSE&catalogNbr=575')],
    },
  },
  {
    match: /how heavy|final project/i,
    reply: {
      thinkMs: 4200,
      text: `From the latest **CSE 511 syllabus**:

- **Grading:** assignments 40%, team project 35%, final exam 25%
- **Team project:** groups of 3–4 build a data pipeline on a real dataset. Your four fits.
- **Weekly load:** one programming assignment, about 6–8 hours`,
      citations: ['https://www.asu.edu/syllabi/cse-511-data-processing-at-scale.pdf'],
      warnings: ['This syllabus is from a past term. Spring details may change.'],
    },
  },
  {
    match: /profs|professor|students say/i,
    reply: {
      thinkMs: 4200,
      text: `Rate My Professors, for this spring’s CSE 511 instructors:

| Instructor | Section | Rating | Students mention |
|---|---|---|---|
| Dr. Nova Reyes | Tue/Thu 10:30 | 4.4 / 5 | clear lectures, fair project grading |
| Dr. Theo Lindqvist | Mon/Wed 8:00 | 3.7 / 5 | tough exams, great office hours |`,
      citations: ['https://www.ratemyprofessors.com/professor/demo-reyes', 'https://www.ratemyprofessors.com/professor/demo-lindqvist'],
      warnings: ['Professor reviews are a limited sample, not complete coverage.'],
    },
  },
  {
    match: /which section|works for all/i,
    reply: {
      thinkMs: 5600,
      text: `I compared everyone’s schedules. **CSE 511, Tue/Thu 10:30** works for all four of you:

- **Maya**: no 8 a.m. start ✓
- **Jordan**: free right after his 9:00 lab ✓
- **Priya**: Tue/Thu mornings are open ✓
- **Leo**: his job is Mon/Wed afternoons, no clash ✓

It also has the higher-rated instructor and 18 open seats. I proposed a task so the group registers before seats go.`,
      citations: [catalog('subject=CSE&catalogNbr=511&days=TTh')],
      task: { title: 'Register for CSE 511 (Tue/Thu 10:30)', description: 'All four of us, before seats fill up.', assigneeId: ME },
      facts: [
        { text: 'Taking CSE 511 together, Tue/Thu 10:30 section.', kind: 'decision' },
        { text: 'No 8 a.m. sections.', kind: 'constraint' },
      ],
    },
  },
  {
    match: /weather/i,
    reply: {
      thinkMs: 5000,
      text: `Saturday’s forecast from the National Weather Service:

| | Sedona | Flagstaff |
|---|---|---|
| Sky | ☀️ Sunny | ⛅ Clouds after 2 pm |
| High / low | 78° / 49° | 61° / 33° |
| Rain | 0% | 30% late afternoon |

**Sedona** looks better for hiking: warm, dry and clear. Start early, because trails get full sun by noon.`,
      citations: ['https://forecast.weather.gov/MapClick.php?textField1=34.87&textField2=-111.76', 'https://forecast.weather.gov/MapClick.php?textField1=35.20&textField2=-111.65'],
    },
  },
  {
    match: /slide rock|parking/i,
    reply: {
      thinkMs: 5200,
      text: `**Slide Rock State Park** this Saturday, from the park’s official pages:

- **Hours:** 8 a.m. to 6 p.m.
- **Entry:** about $20 per car (up to 4 people), so roughly $5 each
- **Heads up:** the lot fills by late morning on warm weekends. Arriving at 2:30 may mean a short wait.`,
      citations: ['https://azstateparks.com/slide-rock', 'https://azstateparks.com/slide-rock/explore/fees'],
    },
  },
  {
    match: /plan our day|plan the day/i,
    reply: {
      thinkMs: 5600,
      text: `Here’s your Saturday in Sedona 🌵

1. **9:00** Leave Tempe, about 2 hours up I-17
2. **11:15** Cathedral Rock Trail: short, steep, about 1.2 mi round trip, best views in town
3. **1:00** Lunch in Uptown Sedona. **Maya’s vegetarian**, so I picked spots with solid veggie menus
4. **2:30** Slide Rock State Park to cool off in the creek
5. **5:30** Head home, back before dark

I added a task so nobody forgets water.`,
      citations: ['https://www.fs.usda.gov/recarea/coconino/recarea/?recid=55255', 'https://azstateparks.com/slide-rock'],
      task: { title: 'Bring 3 L of water each', description: 'Cathedral Rock has no shade at the top.', assigneeId: null },
      facts: [{ text: 'Day trip to Sedona on Saturday, leaving Tempe at 9.', kind: 'decision' }],
    },
  },
];

export function seedMemories(approved: boolean): MemoryFact[] {
  const now = ago(30);
  const base = { ownerId: ME, version: 1, source: 'conversation' as const, sourcePartyId: CLASS_ID, createdAt: now, updatedAt: now, syncState: 'synced' as const };
  return [
    { ...base, id: 'mem-veg', text: 'Vegetarian. Avoids meat dishes.', category: 'Dietary', approval: approved ? 'approved' : 'candidate', approvedVersion: approved ? 1 : undefined, sourceMessageIds: [VEGETARIAN_MESSAGE_ID] },
    { ...base, id: 'mem-8am', text: 'Avoids 8 a.m. classes. Prefers starts after 10.', category: 'Schedule', approval: 'candidate', sourceMessageIds: [VEGETARIAN_MESSAGE_ID] },
    { ...base, id: 'mem-cs', text: 'Computer science grad student at ASU, Tempe campus.', category: 'Background', approval: 'approved', approvedVersion: 1, source: 'manual', sourcePartyId: undefined, sourceMessageIds: undefined },
  ];
}
