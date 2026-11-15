import { createRoot } from 'react-dom/client';
import { App, configureAmplify, ConfigRequired } from './App';
import { loadRuntimeConfig } from './runtime';
import './styles.css';

const root = createRoot(document.getElementById('root')!);
root.render(<main className="boot-screen"><span className="boot-mark">v</span><span>Preparing Vibe…</span></main>);

void loadRuntimeConfig().then((result) => {
  if (!result.config) {
    root.render(<ConfigRequired result={result} />);
    return;
  }
  configureAmplify(result.config);
  root.render(<App config={result.config} />);
}).catch(() => {
  root.render(<ConfigRequired result={{ missing: [], source: 'none', loadError: 'Vibe could not read its deployment settings.' }} />);
});
