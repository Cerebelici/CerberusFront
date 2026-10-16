import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Fallbacks used only when the corresponding variable is absent from .env.
// See .env.example for documentation of every setting.
const FALLBACK_PROXY_TARGET = 'http://localhost:8080'
const FALLBACK_DEV_HOST = 'localhost'
const FALLBACK_DEV_PORT = 5173

function parsePort(value: string | undefined, fallback: number): number {
  const port = Number.parseInt(value ?? '', 10)
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : fallback
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Empty prefix: load DEV_* keys too. They are only read here and never reach the bundle.
  const env = loadEnv(mode, process.cwd(), '')

  const proxyTarget = env.DEV_PROXY_TARGET?.trim() || FALLBACK_PROXY_TARGET
  const host = env.DEV_SERVER_HOST?.trim() || FALLBACK_DEV_HOST
  const port = parsePort(env.DEV_SERVER_PORT, FALLBACK_DEV_PORT)

  const proxy = {
    '/api': { target: proxyTarget, changeOrigin: false },
  }

  return {
    plugins: [react()],
    server: { host, port, proxy },
    preview: { host, port, proxy },
  }
})
