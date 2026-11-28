import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // explicit IPv4: "localhost" makes Vite listen on ::1 only
    host: '127.0.0.1',
    // same origin in dev, so the API's session cookie just works; uvicorn listens on 127.0.0.1 by default
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
})
