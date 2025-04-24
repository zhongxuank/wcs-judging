import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// Trigger new deployment with environment variables
export default defineConfig({
  plugins: [react()],
  base: '/wcs-judging/',
  build: {
    rollupOptions: {
      output: {
        // Add timestamp to chunk names to force cache invalidation
        chunkFileNames: `assets/[name]-[hash]-${Date.now()}.js`,
        entryFileNames: `assets/[name]-[hash]-${Date.now()}.js`,
        assetFileNames: `assets/[name]-[hash]-${Date.now()}.[ext]`
      }
    }
  },
  envPrefix: 'VITE_',  // This ensures Vite picks up our environment variables
  publicDir: 'public'  // Ensure public directory is included in the build
})
