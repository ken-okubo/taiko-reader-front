import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/scores': 'http://localhost:8010',
      '/health': 'http://localhost:8010',
    },
  },
})
