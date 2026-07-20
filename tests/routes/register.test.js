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

const createApp = async (overrides = {}) => {
  const app = await buildBackendApp({ logger: false })

  // Mock auth functions
  for (const key in app.auth) {
    if (typeof app.auth[key] === 'function' && !overrides[key]) {
      app.auth[key] = vi.fn(app.auth[key])
    }
  }

  for (const key in overrides) {
    if (key !== 'createUser' && Object.prototype.hasOwnProperty.call(overrides, key)) {
      app.auth[key] = overrides[key]
    }
  }

  app.createUser = overrides.createUser || vi.fn(app.createUser)

  // Add a test route for CSRF token generation
  app.get('/test/csrf', async (_req, reply) => {
    return { csrfToken: reply.generateCsrf() }
  })

  return { app: app, auth: app.auth }
}

describe('register routes', () => {
  const apps = []

  afterEach(async () => {
    while (apps.length > 0) {
      const app = apps.pop()
      await app.close()
    }
  })

  it('POST /api/register returns 400 when required fields are missing', async () => {
    const { app, auth } = await createApp()
    apps.push(app)
    const { csrfToken, cookieHeader } = await getCsrfContext(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/register',
      headers: {
        cookie: cookieHeader,
        'x-csrf-token': csrfToken,
      },
      payload: {
        email: 'new.user@example.com',
        nick: 'newuser',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('required')
    expect(app.createUser).not.toHaveBeenCalled()
  })

  it('POST /api/register returns 400 for invalid email format', async () => {
    const { app, auth } = await createApp()
    apps.push(app)
    const { csrfToken, cookieHeader } = await getCsrfContext(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/register',
      headers: {
        cookie: cookieHeader,
        'x-csrf-token': csrfToken,
      },
      payload: {
        email: 'invalid-email',
        nick: 'newuser',
        fullName: 'New User',
        phone: '+10000000002',
        memberId: 'MBR-9001',
        password: 'password123',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('format')
    expect(app.createUser).not.toHaveBeenCalled()
  })

  it('POST /api/register returns 400 for invalid phone number', async () => {
    const { app, auth } = await createApp()
    apps.push(app)
    const { csrfToken, cookieHeader } = await getCsrfContext(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/register',
      headers: {
        cookie: cookieHeader,
        'x-csrf-token': csrfToken,
      },
      payload: {
        email: 'another.unique.user@example.com',
        nick: 'anotheruniqueuser',
        fullName: 'New User',
        phone: 'abc',
        memberId: 'MBR-9001-UNIQUE',
        password: 'password123',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('pattern')
    expect(app.createUser).not.toHaveBeenCalled()
  })

  it('POST /api/register returns 409 for duplicate email', async () => {
    const duplicateEmailError = Object.assign(
      new Error('Unique constraint failed on the fields: (`email`)'),
      {
        code: 'P2002',
        meta: { target: ['email'] },
      },
    )

    const { app, auth } = await createApp({
      createUser: vi.fn().mockRejectedValue(duplicateEmailError),
    })
    apps.push(app)
    const { csrfToken, cookieHeader } = await getCsrfContext(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/register',
      headers: {
        cookie: cookieHeader,
        'x-csrf-token': csrfToken,
      },
      payload: {
        email: 'admin@example.com',
        nick: 'anotheruser',
        fullName: 'Another User',
        phone: '+10000000003',
        memberId: 'MBR-9002',
        password: 'password123',
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({
      error: 'Email already registered',
    })
    expect(auth.setSession).not.toHaveBeenCalled()
  })

  it('POST /api/register returns 409 for duplicate phone number', async () => {
    const duplicatePhoneError = Object.assign(
      new Error('Unique constraint failed on the fields: (`phone`)'),
      {
        code: 'P2002',
        meta: { target: ['phone'] },
      },
    )

    const { app, auth } = await createApp({
      createUser: vi.fn().mockRejectedValue(duplicatePhoneError),
    })
    apps.push(app)
    const { csrfToken, cookieHeader } = await getCsrfContext(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/register',
      headers: {
        cookie: cookieHeader,
        'x-csrf-token': csrfToken,
      },
      payload: {
        email: 'new.user@example.com',
        nick: 'newuser',
        fullName: 'New User',
        phone: '+10000000002', // Duplicate phone
        memberId: 'MBR-9001',
        password: 'password123',
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({
      error: 'Phone Number already registered',
    })
    expect(auth.setSession).not.toHaveBeenCalled()
  })

  it('POST /api/register returns 409 for duplicate nick', async () => {
    const duplicateNickError = Object.assign(
      new Error('Unique constraint failed on the fields: (`nick`)'),
      {
        code: 'P2002',
        meta: { target: ['nick'] },
      },
    )

    const { app, auth } = await createApp({
      createUser: vi.fn().mockRejectedValue(duplicateNickError),
    })
    apps.push(app)
    const { csrfToken, cookieHeader } = await getCsrfContext(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/register',
      headers: {
        cookie: cookieHeader,
        'x-csrf-token': csrfToken,
      },
      payload: {
        email: 'new.user@example.com',
        nick: 'existingnick', // Duplicate nick
        fullName: 'New User',
        phone: '+10000000002',
        memberId: 'MBR-9001',
        password: 'password123',
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({
      error: 'Nick already registered',
    })
    expect(auth.setSession).not.toHaveBeenCalled()
  })

  it('POST /api/register returns 409 for duplicate memberId', async () => {
    const duplicateMemberIdError = Object.assign(
      new Error('Unique constraint failed on the fields: (`memberId`)'),
      {
        code: 'P2002',
        meta: { target: ['memberId'] },
      },
    )

    const { app, auth } = await createApp({
      createUser: vi.fn().mockRejectedValue(duplicateMemberIdError),
    })
    apps.push(app)
    const { csrfToken, cookieHeader } = await getCsrfContext(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/register',
      headers: {
        cookie: cookieHeader,
        'x-csrf-token': csrfToken,
      },
      payload: {
        email: 'new.user@example.com',
        nick: 'newuser',
        fullName: 'New User',
        phone: '+10000000002',
        memberId: 'existing-member-id', // Duplicate memberId
        password: 'password123',
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({
      error: 'Member ID already registered',
    })
    expect(auth.setSession).not.toHaveBeenCalled()
  })

  it('POST /api/register returns 500 when createUser returns falsy', async () => {
    const { app, auth } = await createApp({
      createUser: vi.fn().mockResolvedValue(null),
    })
    apps.push(app)
    const { csrfToken, cookieHeader } = await getCsrfContext(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/register',
      headers: {
        cookie: cookieHeader,
        'x-csrf-token': csrfToken,
      },
      payload: {
        email: 'new.user@example.com',
        nick: 'newuser',
        fullName: 'New User',
        phone: '+10000000002',
        memberId: 'MBR-9001',
        password: 'password123',
      },
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ error: 'Registration failed' })
    expect(auth.setSession).not.toHaveBeenCalled()
  })

  it('POST /api/register returns 500 with error message on non-P2002 error', async () => {
    const { app, auth } = await createApp({
      createUser: vi.fn().mockRejectedValue(new Error('Database connection error')),
    })
    apps.push(app)
    const { csrfToken, cookieHeader } = await getCsrfContext(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/register',
      headers: {
        cookie: cookieHeader,
        'x-csrf-token': csrfToken,
      },
      payload: {
        email: 'new.user@example.com',
        nick: 'newuser',
        fullName: 'New User',
        phone: '+10000000002',
        memberId: 'MBR-9001',
        password: 'password123',
      },
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ error: 'Database connection error' })
    expect(auth.setSession).not.toHaveBeenCalled()
  })

  it('POST /api/register returns 200 with success message on success', async () => {
    const { app, auth } = await createApp({
      createUser: vi.fn().mockResolvedValue({
        id: 42,
        email: 'new.user@example.com',
      }),
    })
    apps.push(app)
    const { csrfToken, cookieHeader } = await getCsrfContext(app)

    const payload = {
      email: 'new.user@example.com',
      nick: 'newuser',
      fullName: 'New User',
      phone: '+10000000002',
      memberId: 'MBR-9001',
      password: 'password123',
    }

    const response = await app.inject({
      method: 'POST',
      url: '/api/register',
      headers: {
        cookie: cookieHeader,
        'x-csrf-token': csrfToken,
      },
      payload,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ success: true, message: 'Registration went successfully' })
    expect(app.createUser).toHaveBeenCalledWith({
      email: payload.email,
      nick: payload.nick,
      fullName: payload.fullName,
      phone: payload.phone,
      memberId: payload.memberId,
      password: payload.password,
    })
    expect(auth.setSession).not.toHaveBeenCalled()
  })
})
