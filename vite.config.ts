import { defineConfig } from 'vite';
export default defineConfig({ base: './', build: { rollupOptions: { input: { game: 'index.html', lab: 'lab/index.html' } } } });
