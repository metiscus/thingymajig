import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Essential for Electron to correctly load assets relative to index.html
  build: {
    outDir: 'dist', // Output React build to the 'dist' folder
  },
});