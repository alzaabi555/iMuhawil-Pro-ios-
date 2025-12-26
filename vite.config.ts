import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Cast process to any to prevent TS error about cwd missing on Process type
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    base: './', // Crucial for Electron and Capacitor to load assets from local file system
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    define: {
      // Prioritize the process.env (GitHub Secrets) over local .env files
      'process.env.API_KEY': JSON.stringify(process.env.API_KEY || env.API_KEY)
    }
  };
});