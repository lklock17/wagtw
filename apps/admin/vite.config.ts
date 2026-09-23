import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    port: 5174,
    host: '0.0.0.0'
  },
  preview: {
    port: 5174,
    host: '0.0.0.0'
  }
})
