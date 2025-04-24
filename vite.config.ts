import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// Trigger new deployment with environment variables
export default defineConfig({
  plugins: [react()],
  base: '/wcs-judging/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  envPrefix: 'VITE_',  // This ensures Vite picks up our environment variables
  publicDir: 'public'  // Ensure public directory is included in the build
})
