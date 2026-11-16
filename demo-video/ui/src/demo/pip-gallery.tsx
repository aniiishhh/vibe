/* Demo-only page that renders the real Pip component for close-ups.
 * ?view=outfits shows Pip in all seven theme outfits on their own backdrops.
 * ?view=solo&theme=outdoors&state=idle&action=juggle shows one large Pip. */
import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { Mascot, type MascotState } from '../mascot';
import { backdrops, PartyBackdrop, type BackdropId } from '../backdrops';
import '../styles.css';

const params = new URLSearchParams(window.location.search);

function Outfits() {
  return (
    <main style={{ position: 'fixed', inset: 0, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#fff' }}>
      {backdrops.map((item, index) => (
        <section key={item.id} className="party-workspace" style={{ position: 'relative', overflow: 'hidden', display: 'grid', placeItems: 'center', ['--party-hue' as string]: item.hue }}>
          <PartyBackdrop id={item.id} />
          <div style={{ position: 'relative', display: 'grid', justifyItems: 'center', gap: 18 }}>
            <Mascot theme={item.id} size={210} state={index % 3 === 1 ? 'wave' : index % 3 === 2 ? 'excited' : 'idle'} fidget={false} />
            <strong style={{ font: '600 26px Geist, sans-serif', color: '#1f1b27' }}>{item.label}</strong>
          </div>
        </section>
      ))}
    </main>
  );
}

function Solo() {
  const theme = (params.get('theme') ?? 'outdoors') as BackdropId;
  const [state, setState] = useState<MascotState>((params.get('state') ?? 'idle') as MascotState);
  const [action, setAction] = useState<{ name: 'juggle'; key: number } | null>(null);
  useEffect(() => {
    (window as unknown as { __pip: unknown }).__pip = {
      state: (next: MascotState) => setState(next),
      act: (name: 'juggle') => setAction({ name, key: Date.now() }),
    };
    if (params.get('action')) window.setTimeout(() => setAction({ name: params.get('action') as 'juggle', key: Date.now() }), 400);
  }, []);
  const hue = backdrops.find((item) => item.id === theme)!.hue;
  if (params.get('bare')) {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    return <main style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: 'transparent' }}><div id="pip-bare" style={{ padding: 40 }}><Mascot theme={theme} size={520} state={state} action={action} fidget={false} /></div></main>;
  }
  return (
    <main className="party-workspace" style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', ['--party-hue' as string]: hue }}>
      <PartyBackdrop id={theme} />
      <div style={{ position: 'relative' }}><Mascot theme={theme} size={520} state={state} action={action} fidget={false} /></div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(params.get('view') === 'solo' ? <Solo /> : <Outfits />);
