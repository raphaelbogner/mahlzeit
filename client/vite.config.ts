import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/w/',
  server: {
    proxy: {
      '/api': 'http://mahlzeit.test',
      '/admin/api': 'http://mahlzeit.test',
    },
  },
});
