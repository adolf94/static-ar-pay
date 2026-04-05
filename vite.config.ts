import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true,
    allowedHosts: [
      "telegram.adolfrey.com"
    ],
    port: 7239,
  },
  plugins: [react()],
})
