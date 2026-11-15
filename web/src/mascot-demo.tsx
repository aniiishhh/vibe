import { useState } from 'react';
import { Link } from 'react-router-dom';
import { backdrops, backdropStyle, PartyBackdrop, type BackdropId } from './backdrops';
import { Mascot, MASCOT_STATES, type MascotState } from './mascot';

const statusFor: Partial<Record<MascotState, string>> = {
  wave: 'Hey there!', listening: 'Listening…', curious: 'Hmm?', excited: 'Woo!', laughing: 'Haha!', love: 'Aww', sad: 'Sending hugs',
  summoned: 'You rang?', thinking: 'Pondering…', working: 'Working on it…', reading: 'Reading…', done: 'Done!', error: 'Oops', held: 'Wheee!', dizzy: 'Whoa…', sleeping: 'Zzz',
};

/** Development-only gallery of Pip's states and theme props, at /pip. */
export function MascotDemo() {
  const [state, setState] = useState<MascotState>('idle');
  const [theme, setTheme] = useState<BackdropId | null>(null);
  return (
    <main className="pip-demo" style={theme ? backdropStyle(theme) : undefined}>
      <PartyBackdrop id={theme ?? 'chill'} />
      <div className="pip-demo-inner">
        <header className="pip-demo-header"><Link to="/" className="text-button">Back to app</Link><h1>Pip</h1><span /></header>
        <Mascot state={state} theme={theme} size={240} followPointer label="Pip" status={statusFor[state] ?? null} />
        <div className="segmented pip-demo-controls" role="radiogroup" aria-label="Pip state">
          {MASCOT_STATES.map((option) => <button key={option.id} type="button" role="radio" aria-checked={state === option.id} className={state === option.id ? 'segmented-on' : ''} onClick={() => setState(option.id)}>{option.label}</button>)}
        </div>
        <div className="segmented pip-demo-controls" role="radiogroup" aria-label="Theme prop">
          <button type="button" role="radio" aria-checked={theme === null} className={theme === null ? 'segmented-on' : ''} onClick={() => setTheme(null)}>No prop</button>
          {backdrops.map((item) => <button key={item.id} type="button" role="radio" aria-checked={theme === item.id} className={theme === item.id ? 'segmented-on' : ''} onClick={() => setTheme(item.id)}>{item.label}</button>)}
        </div>
        <div className="pip-demo-grid">
          {MASCOT_STATES.map((option) => (
            <button key={option.id} type="button" className="pip-demo-cell" onClick={() => setState(option.id)}>
              <Mascot state={option.id} theme={theme} size={120} />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
        <div className="pip-demo-grid">
          {backdrops.map((item) => (
            <button key={item.id} type="button" className="pip-demo-cell" style={backdropStyle(item.id)} onClick={() => setTheme(item.id)}>
              <Mascot state="idle" theme={item.id} size={110} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
