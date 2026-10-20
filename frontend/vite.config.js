import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('@tanstack')) {
              return 'vendor';
            }
            if (id.includes('lucide') || id.includes('@phosphor-icons')) {
              return 'icons';
            }
          }
        },
      },
    },
  },
})
