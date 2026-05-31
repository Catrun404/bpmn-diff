import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: {
    entries: [
      'index.html',
    ],
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
      },
    },
  },
  server: {
    host: true,
    fs: {
      allow: ['..']
    },
    watch: {
      usePolling: true,
    },
  },
})
