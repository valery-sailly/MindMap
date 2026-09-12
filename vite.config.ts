/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base: '/MindMap/' matches the GitHub Pages project URL (https://<user>.github.io/MindMap/)
export default defineConfig({
  base: '/MindMap/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
