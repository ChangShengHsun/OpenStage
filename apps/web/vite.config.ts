import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Pre-bundle deps the dev server would otherwise optimize on demand —
    // an on-demand optimize reloads the page mid-test/mid-click.
    include: ['jspdf', 'yjs', 'y-websocket', 'three', '@react-three/fiber'],
  },
});
