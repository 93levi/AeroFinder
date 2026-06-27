import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Local dev: forward /api/* to the HTTP-only teaching API so the browser
  // only ever talks to the dev server (mirrors the Vercel rewrite in prod).
  server: {
    proxy: {
      '/api': {
        target: 'http://4.237.58.241:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
