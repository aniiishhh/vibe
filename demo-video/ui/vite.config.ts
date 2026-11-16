import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Demo clone: same UI as web/, with shared types copied locally and AWS Amplify
// replaced by in-browser stubs so it runs with scripted data and no backend.
const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: '@vibe/shared', replacement: here('./shared/index.ts') },
      { find: /^aws-amplify(\/.*)?$/, replacement: here('./src/demo/amplify-stub.ts') },
    ],
  },
  build: {
    rollupOptions: { input: { main: here('./index.html'), pip: here('./pip.html') } },
  },
  server: { host: '127.0.0.1', port: 5199, strictPort: true },
});
