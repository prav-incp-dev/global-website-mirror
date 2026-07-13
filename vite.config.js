import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteFastifyReact from '@fastify/react/plugin'

export default defineConfig({
  plugins: [react(), viteFastifyReact()],
})
