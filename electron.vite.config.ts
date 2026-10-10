import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const alias = { '@shared': resolve(__dirname, 'src/shared') }

export default defineConfig({
  main: {
    resolve: { alias }
  },
  preload: {
    resolve: { alias }
  },
  renderer: {
    resolve: { alias },
    plugins: [react(), tailwindcss()],
    build: {
      minify: true,
      rollupOptions: {
        input: {
          wall: resolve(__dirname, 'src/renderer/wall.html'),
          admin: resolve(__dirname, 'src/renderer/admin.html')
        }
      }
    }
  }
})
