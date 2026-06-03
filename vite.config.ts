import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Make sure environment variables starting with VITE_ are visible in the app
    'process.env': {}
  }
});