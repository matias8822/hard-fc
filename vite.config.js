import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      '.trycloudflare.com'   // 👈 esto permite cualquier subdominio de trycloudflare
    ]
  }
})
