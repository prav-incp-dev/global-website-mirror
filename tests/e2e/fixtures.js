import { test as base, expect } from '@playwright/test'
import { resetDatabase } from './db.js'

/**
 * Custom Playwright test fixture that automatically resets the
 * test database to its seeded state before every test.
 *
 * Usage in spec files:
 *
 *   import { test, expect } from './fixtures.js'
 *
 *   test('my test', async ({ page }) => { ... })
 */
export const test = base.extend({
  // Auto fixture: reset DB before every test while preserving built-in page.
  dbReset: [async ({}, run) => {
    await resetDatabase()
    await run()
  }, { auto: true }],
})

export { expect }
