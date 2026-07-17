import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import { buildBackendApp } from '../../backend.js'

const toCookieHeader = (setCookieHeader) => {
  if (!setCookieHeader) {
    return ''
  }

  const values = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader]

  return values.map((cookieValue) => cookieValue.split(';')[0]).join('; ')
}

const createApp = async (authOverrides = {}) => {
  const app = await buildBackendApp({ logger: false })

  // Mock auth functions
  for (const key in app.auth) {
    if (typeof app.auth[key] === 'function' && !authOverrides[key]) {
      app.auth[key] = vi.fn(app.auth[key])
    }
  }

  for (const key in authOverrides) {
    if (Object.prototype.hasOwnProperty.call(authOverrides, key)) {
      app.auth[key] = authOverrides[key]
    }
  }

  // Add a test route for CSRF token generation
  app.get('/test/csrf', async (_req, reply) => {
    return { csrfToken: reply.generateCsrf() }
  })

  return { app: app, auth: app.auth }
}

const getCsrfContext = async (app) => {
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

  it('POST /api/auth/login returns 400 when email or password is missing', async () => {
    const { app, auth } = await createApp()
    apps.push(app)
    const { csrfToken, cookieHeader } = await getCsrfContext(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
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

  it('POST /api/auth/login returns 401 when credentials are invalid', async () => {
    const { app, auth } = await createApp({
      login: vi.fn().mockResolvedValue(null),
    })
    apps.push(app)
    const { csrfToken, cookieHeader } = await getCsrfContext(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: {
        cookie: cookieHeader,
        'x-csrf-token': csrfToken,
      },
      payload: {
        email: 'admin@example.com',
        password: 'wrong-password',
      },
    })

    expect(auth.login).toHaveBeenCalledWith(
      'admin@example.com',
      'wrong-password',
    )
    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({
      error: 'Invalid email or password',
    })
    expect(auth.createTwoFactorCode).not.toHaveBeenCalled()
    expect(auth.setSession).not.toHaveBeenCalled()
  })

  it('POST /api/auth/login returns 200 with token and sends email with confirmation code', async () => {
    // Clean up any previous email fixture
    const fixturePath = path.join(__dirname, '../fixtures', 'last-email.json')
    if (fs.existsSync(fixturePath)) fs.unlinkSync(fixturePath)

    const user = { id: 1, email: 'admin@example.com' }
    const { app, auth } = await createApp({
      login: vi.fn().mockResolvedValue(user),
      createTwoFactorCode: vi.fn().mockResolvedValue('123456'),
      signPendingAuth: vi.fn().mockReturnValue('mock-jwt-token'),
    })
    apps.push(app)
    const { csrfToken, cookieHeader } = await getCsrfContext(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
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
      token: 'mock-jwt-token',
    })
    expect(auth.createTwoFactorCode).toHaveBeenCalledWith(user)
    expect(auth.signPendingAuth).toHaveBeenCalledWith(1)
    expect(auth.setSession).not.toHaveBeenCalled()

    // Verify email was sent
    const emailContent = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'))
    expect(emailContent.subject).toBe('Your confirmation code')
    expect(emailContent.to).toBe(user.email)
    expect(emailContent.text).toContain('123456')
  })

  it('POST /api/auth/confirm returns 400 when token or code is missing', async () => {
    const { app } = await createApp()
    apps.push(app)
    const { csrfToken, cookieHeader } = await getCsrfContext(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/confirm',
      headers: {
        cookie: cookieHeader,
        'x-csrf-token': csrfToken,
      },
      payload: { code: '123456' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      error: 'Token and code are required',
    })
  })

  it('POST /api/auth/confirm returns 401 when token is invalid', async () => {
    const { app, auth } = await createApp({
      verifyPendingAuth: vi.fn().mockReturnValue(null),
    })
    apps.push(app)
    const { csrfToken, cookieHeader } = await getCsrfContext(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/confirm',
      headers: {
        cookie: cookieHeader,
        'x-csrf-token': csrfToken,
      },
      payload: { token: 'invalid-token', code: '123456' },
    })

    expect(auth.verifyPendingAuth).toHaveBeenCalledWith('invalid-token')
    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({
      error: 'Invalid or expired token',
    })
    expect(auth.verifyTwoFactorCode).not.toHaveBeenCalled()
    expect(auth.setSession).not.toHaveBeenCalled()
  })

  it('POST /api/auth/confirm returns 401 when code is invalid', async () => {
    const { app, auth } = await createApp({
      verifyPendingAuth: vi.fn().mockReturnValue(1),
      verifyTwoFactorCode: vi.fn().mockResolvedValue(false),
    })
    apps.push(app)
    const { csrfToken, cookieHeader } = await getCsrfContext(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/confirm',
      headers: {
        cookie: cookieHeader,
        'x-csrf-token': csrfToken,
      },
      payload: { token: 'valid-token', code: 'wrong-code' },
    })

    expect(auth.verifyTwoFactorCode).toHaveBeenCalledWith(1, 'wrong-code')
    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({
      error: 'Invalid confirmation code',
    })
    expect(auth.setSession).not.toHaveBeenCalled()
  })

  it('POST /api/auth/confirm returns 200 and sets session on valid code', async () => {
    const { app, auth } = await createApp({
      verifyPendingAuth: vi.fn().mockReturnValue(1),
      verifyTwoFactorCode: vi.fn().mockResolvedValue(true),
    })
    apps.push(app)
    const { csrfToken, cookieHeader } = await getCsrfContext(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/confirm',
      headers: {
        cookie: cookieHeader,
        'x-csrf-token': csrfToken,
      },
      payload: { token: 'valid-token', code: '123456' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      success: true,
      redirect: '/',
    })
    expect(auth.verifyTwoFactorCode).toHaveBeenCalledWith(1, '123456')
    expect(auth.setSession).toHaveBeenCalledTimes(1)
    expect(auth.setSession).toHaveBeenCalledWith(expect.anything(), 1)
  })

  it('POST /api/auth/resend returns 400 when token is missing', async () => {
    const { app } = await createApp()
    apps.push(app)
    const { csrfToken, cookieHeader } = await getCsrfContext(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/resend',
      headers: {
        cookie: cookieHeader,
        'x-csrf-token': csrfToken,
      },
      payload: {},
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      error: 'Token is required',
    })
  })

  it('POST /api/auth/resend returns 401 when token is invalid', async () => {
    const { app, auth } = await createApp({
      verifyPendingAuth: vi.fn().mockReturnValue(null),
    })
    apps.push(app)
    const { csrfToken, cookieHeader } = await getCsrfContext(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/resend',
      headers: {
        cookie: cookieHeader,
        'x-csrf-token': csrfToken,
      },
      payload: { token: 'invalid-token' },
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({
      error: 'Invalid or expired token',
    })
  })

  it('POST /api/auth/resend returns 401 when user does not exist', async () => {
    const { app, auth } = await createApp({
      verifyPendingAuth: vi.fn().mockReturnValue(1),
    })
    apps.push(app)
    const { csrfToken, cookieHeader } = await getCsrfContext(app)

    // Mock fastify.db.user.findUnique to return null, simulating a non-existent user
    app.db = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    }

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/resend',
      headers: {
        cookie: cookieHeader,
        'x-csrf-token': csrfToken,
      },
      payload: { token: 'valid-token' },
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({
      error: 'Invalid or expired token',
    })
    expect(app.db.user.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
    })
    expect(auth.createTwoFactorCode).not.toHaveBeenCalled()
  })

  it('POST /api/auth/resend returns 200 and sends new code when user exists', async () => {
    const user = { id: 1, email: 'admin@example.com' }
    const { app, auth } = await createApp({
      verifyPendingAuth: vi.fn().mockReturnValue(1),
      createTwoFactorCode: vi.fn().mockResolvedValue('654321'),
    })
    apps.push(app)
    const { csrfToken, cookieHeader } = await getCsrfContext(app)

    // Mock fastify.db.user.findUnique to return a user
    app.db = {
      user: {
        findUnique: vi.fn().mockResolvedValue(user),
      },
    }

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/resend',
      headers: {
        cookie: cookieHeader,
        'x-csrf-token': csrfToken,
      },
      payload: { token: 'valid-token' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ success: true })
    expect(app.db.user.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
    })
    expect(auth.createTwoFactorCode).toHaveBeenCalledWith(user)
  })

  it('POST /api/auth/logout returns 200 and clears session', async () => {
    const { app, auth } = await createApp()
    apps.push(app)
    const { csrfToken, cookieHeader } = await getCsrfContext(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        cookie: cookieHeader,
        'x-csrf-token': csrfToken,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      success: true,
      redirect: '/auth',
    })
    expect(auth.clearSession).toHaveBeenCalledTimes(1)
    expect(auth.clearSession).toHaveBeenCalledWith(expect.anything())
  })
})
