import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // same origin in dev, so the API's session cookie just works
    proxy: { '/api': 'http://localhost:8000' },
  },
})
