import { createRoot } from 'react-dom/client';
import { App, BootScreen, configureAmplify, ConfigRequired } from './App';
import { loadRuntimeConfig } from './runtime';
import { applyTheme } from './theme';
import './styles.css';

applyTheme();
const root = createRoot(document.getElementById('root')!);
root.render(<BootScreen />);

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
