import { test as base, expect } from '@playwright/test'
import crypto from 'crypto'
import { resetDatabase } from './db.js'

const BASE_URL = 'http://127.0.0.1:3101'
const SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret-not-for-production'

const signSessionCookie = (userId) => {
  const value = String(userId)
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64').replace(/=+$/, '')

  // Fastify @fastify/cookie format: "<value>.<signature>"
  return `${value}.${signature}`
}

export const test = base.extend({
  dbReset: [
    async ({}, run) => {
      await resetDatabase()
      await run()
    },
    { auto: true },
  ],

  loginAs: async ({ context, page }, run) => {
    const login = async (userId) => {
      await context.addCookies([
        {
          name: 'session',
          value: signSessionCookie(userId),
          url: BASE_URL, // use url OR domain+path, not both
          httpOnly: true,
          sameSite: 'Lax',
        },
      ])
      await page.goto('/')
      await page.waitForLoadState('networkidle')
    }

    await run(login)
  },
})

export { expect }
