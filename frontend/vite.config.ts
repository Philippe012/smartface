/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      // Same-origin proxy so Django session + CSRF cookies work without cross-site cookie issues.
      proxy: {
        '/api': { target: env.DEV_API_PROXY_TARGET || 'http://127.0.0.1:8000', changeOrigin: false },
      },
    },
    build: { sourcemap: false, chunkSizeWarningLimit: 900 },
    test: { environment: 'node', include: ['src/**/*.test.ts'] },
  }
})
