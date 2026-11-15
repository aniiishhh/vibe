import { createRoot } from 'react-dom/client';
import { App, BootScreen, configureAmplify, ConfigRequired } from './App';
import { loadRuntimeConfig } from './runtime';
import { applyTheme } from './theme';
import './styles.css';

applyTheme();
const root = createRoot(document.getElementById('root')!);
root.render(<BootScreen />);

const wantsPreview = import.meta.env.DEV
  && (import.meta.env.VITE_MOCK === '1' || new URLSearchParams(window.location.search).has('mock') || sessionStorage.getItem('vibe.mock') === '1');

if (wantsPreview) {
  sessionStorage.setItem('vibe.mock', '1');
  void import('./mock').then(({ createMockApi, MockAuthProvider }) => {
    root.render(<App
      config={{ region: 'local', userPoolId: 'preview', userPoolClientId: 'preview', apiUrl: '/preview', eventsHttpEndpoint: '', eventsRealtimeEndpoint: '' }}
      preview={{ api: createMockApi(), AuthProvider: MockAuthProvider }}
    />);
  });
} else {
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
}
