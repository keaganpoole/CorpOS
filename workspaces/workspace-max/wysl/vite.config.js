// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  define: {
    // Expose TEST_MODE to our React app
    'process.env.TEST_MODE': JSON.stringify(process.env.TEST_MODE),
  },
  server: {
    host: true,  // <-- exposes the dev server to your LAN
    port: 5173,  // optional, keeps the same port
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
