import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const alias = { '@shared': resolve(import.meta.dirname, 'src/shared') }

export default defineConfig({
  main: {
    resolve: { alias }
  },
  preload: {
    resolve: { alias },
    // A sandboxed preload cannot be an ES module, so it is emitted as CommonJS (index.cjs).
    build: { rolldownOptions: { output: { format: 'cjs' } } }
  },
  renderer: {
    resolve: { alias },
    plugins: [react()]
  }
})
