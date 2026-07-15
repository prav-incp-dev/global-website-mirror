import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteFastifyReact from '@fastify/react/plugin'

export default defineConfig({
  plugins: [react(), viteFastifyReact()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.js',
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'],
  },
})
