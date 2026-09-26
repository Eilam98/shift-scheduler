import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // In development, forward every /api/... request to the Express server,
    // so the client can call fetch("/api/...") without CORS issues or
    // hard-coded ports.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
