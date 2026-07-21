import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteFastifyReact from '@fastify/react/plugin'
import svgr from 'vite-plugin-svgr'

export default defineConfig({
  plugins: [react(), viteFastifyReact(), svgr()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.js',
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'],
    coverage: {
      reporter: ['text'],
    },
  },
})
