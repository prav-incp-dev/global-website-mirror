import { defineConfig } from 'vite'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import viteFastifyReact from '@fastify/react/plugin'
import svgr from 'vite-plugin-svgr'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  plugins: [react(), viteFastifyReact(), svgr()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.js',
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**', '**/stryker-tmp/**'],
    coverage: {
      exclude: ['tests/**', 'src/generated/prisma/**'],
      reporter: ['text'],
    },
  },
})
