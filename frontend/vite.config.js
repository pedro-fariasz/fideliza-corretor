import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
  },
  preview: {
    // Servido atrás do proxy do Railway (npm start) — libera o domínio público.
    allowedHosts: ['.up.railway.app'],
  },
});
