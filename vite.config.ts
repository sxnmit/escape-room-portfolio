import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173 },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2500,
    rolldownOptions: {
      output: {
        // split the big vendor libraries into their own long-lived chunks
        codeSplitting: {
          groups: [
            { name: 'rapier', test: /node_modules[\\/]@dimforge/ },
            { name: 'three', test: /node_modules[\\/](three|postprocessing|@react-three|maath)/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|zustand|framer-motion|motion)/ },
          ],
        },
      },
    },
  },
})
