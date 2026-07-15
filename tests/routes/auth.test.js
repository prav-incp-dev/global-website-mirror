import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import csrfProtection from '@fastify/csrf-protection'
import { afterEach, describe, expect, it, vi } from 'vitest'
import authRoutes from '../../src/routes/auth.js'

const TEST_COOKIE_SECRET = 'test-cookie-secret'

function toCookieHeader(setCookieHeader) {
  if (!setCookieHeader) {
    return ''
  }

  const values = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader]

  return values.map((cookieValue) => cookieValue.split(';')[0]).join('; ')
}

async function createApp(authOverrides = {}) {
  const app = Fastify()

  await app.register(cookie, {
    secret: TEST_COOKIE_SECRET,
  })

  await app.register(csrfProtection, {
    cookieKey: '_csrf',
    cookieOpts: {
      path: '/',
      sameSite: true,
      httpOnly: true,
      signed: true,
    },
  })

  const auth = {
    login: vi.fn(),
    setSession: vi.fn(),
    clearSession: vi.fn(),
    ...authOverrides,
  }

  app.decorate('auth', auth)

  app.get('/test/csrf', async (_req, reply) => {
    return { csrfToken: reply.generateCsrf() }
  })

  await app.register(authRoutes)
  await app.ready()

  return { app, auth }
}

async function getCsrfContext(app) {
  const csrfRes = await app.inject({
    method: 'GET',
    url: '/test/csrf',
  })

  const { csrfToken } = csrfRes.json()
  const cookieHeader = toCookieHeader(csrfRes.headers['set-cookie'])

  return {
    csrfToken,
    cookieHeader,
  }
}

describe('auth routes', () => {
  const apps = []

  afterEach(async () => {
    while (apps.length > 0) {
      const app = apps.pop()
      await app.close()
    }
  })

  it('POST /api/login returns 400 when email or password is missing', async () => {
    const { app, auth } = await createApp()
    apps.push(app)
    const { csrfToken, cookieHeader } = await getCsrfContext(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/login',
      headers: {
        cookie: cookieHeader,
        'x-csrf-token': csrfToken,
      },
      payload: { email: '' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      error: 'Email and password are required',
    })
    expect(auth.login).not.toHaveBeenCalled()
  })

  it('POST /api/login returns 401 when credentials are invalid', async () => {
    const { app, auth } = await createApp({
      login: vi.fn().mockResolvedValue(null),
    })
    apps.push(app)
    const { csrfToken, cookieHeader } = await getCsrfContext(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/login',
      headers: {
        cookie: cookieHeader,
        'x-csrf-token': csrfToken,
      },
      payload: {
        email: 'admin@example.com',
        password: 'wrong-password',
      },
    })

    expect(auth.login).toHaveBeenCalledWith('admin@example.com', 'wrong-password')
    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({
      error: 'Invalid email or password',
    })
    expect(auth.setSession).not.toHaveBeenCalled()
  })

  it('POST /api/login returns 200 and sets session on valid credentials', async () => {
    const user = { id: 'user-1' }
    const { app, auth } = await createApp({
      login: vi.fn().mockResolvedValue(user),
    })
    apps.push(app)
    const { csrfToken, cookieHeader } = await getCsrfContext(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/login',
      headers: {
        cookie: cookieHeader,
        'x-csrf-token': csrfToken,
      },
      payload: {
        email: 'admin@example.com',
        password: 'password',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      success: true,
      redirect: '/',
    })
    expect(auth.setSession).toHaveBeenCalledTimes(1)
    expect(auth.setSession).toHaveBeenCalledWith(expect.anything(), 'user-1')
  })

  it('POST /api/logout returns 200 and clears session', async () => {
    const { app, auth } = await createApp()
    apps.push(app)
    const { csrfToken, cookieHeader } = await getCsrfContext(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/logout',
      headers: {
        cookie: cookieHeader,
        'x-csrf-token': csrfToken,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      success: true,
      redirect: '/login',
    })
    expect(auth.clearSession).toHaveBeenCalledTimes(1)
    expect(auth.clearSession).toHaveBeenCalledWith(expect.anything())
  })
})
