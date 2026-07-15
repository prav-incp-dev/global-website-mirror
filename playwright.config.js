import { defineConfig } from '@playwright/test'
import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '.env.test'), override: true })

export default defineConfig({
  testDir: './tests/e2e',
  globalTeardown: './tests/e2e/global-teardown.js',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  // Serialise tests so the per-test DB reset doesn't collide across workers
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:3101',
    headless: true,
  },
  webServer: {
    command: 'npm run db:test:setup && PORT=3101 npm run dev',
    url: 'http://127.0.0.1:3101',
    // Always start a fresh server so the DB is in a known state
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
