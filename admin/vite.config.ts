import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Admin app: ships at the domain root in production. The dev server proxies
// /admin/api/* to a local PHP server (php -S 127.0.0.1:8000 -t server/) so
// that cookies and CSRF flow through normally.
//
// Run alongside the dev server with:
//   php -S 127.0.0.1:8000 -t server/
//   cd admin && npm run dev
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/admin/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: false,
      },
    },
  },
})
