import { defineConfig } from 'vite';
export default defineConfig({ base: './', build: { manifest: true, rollupOptions: { input: { game: 'index.html', lab: 'lab/index.html' } } } });
