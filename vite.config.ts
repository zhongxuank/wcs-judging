import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// Trigger new deployment with environment variables
export default defineConfig({
  plugins: [react()],
  base: '/wcs-judging/'
})
