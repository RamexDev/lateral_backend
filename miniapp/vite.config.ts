// Vite configuration for the Zwuwur Mini App v2.
// Tailwind v4 is wired up through its first-party Vite plugin — no separate
// PostCSS or tailwind.config.js file is needed (CSS-first config in styles/index.css).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // React (JSX + Fast Refresh) and Tailwind v4 plugins.
  plugins: [react(), tailwindcss()],

  // Local dev server — must be reachable by the Telegram client and the
  // backend's CORS policy.
  server: {
    port: 5173,
    host: true
  }
});
