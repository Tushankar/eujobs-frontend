import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // The API runs locally; the e2e harness points the proxy at its own server (M-204).
  server: {
    proxy: {
      '/api': process.env.VITE_API_PROXY ?? 'http://localhost:5000',
    },
  },
})
