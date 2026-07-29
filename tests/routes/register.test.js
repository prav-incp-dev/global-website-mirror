import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildBackendApp } from '../../backend.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const lastEmailFixturePath = path.join(__dirname, '../fixtures/last-email.json')

const toCookieHeader = (setCookieHeader) => {
  if (!setCookieHeader) {
    return ''
  }

  const values = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader]

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

  app.registration = {
    createUser: overrides.createUser || vi.fn(app.registration.createUser),
    verifyToken: overrides.verifyToken || vi.fn().mockResolvedValue({ inviteCode: 'test-jti', owner: null }),
  }

  app.prisma = {
    ...app.prisma,
    usedInvite: {
      ...app.prisma?.usedInvite,
      findUnique: overrides.findUsedInvite || vi.fn().mockResolvedValue(null),
      create: overrides.createUsedInvite || vi.fn().mockResolvedValue({ id: 1, code: 'test-jti' }),
    },
  }

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
    const { app } = await createApp()
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
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('required')
    expect(app.registration.createUser).not.toHaveBeenCalled()
  })

  it('POST /api/register returns 400 for invalid email format', async () => {
    const { app } = await createApp()
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
        firstName: 'New',
        phone: '+375291234567',
        password: 'password123',
        token: 'some-token',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('format')
    expect(app.registration.createUser).not.toHaveBeenCalled()
  })

  it('POST /api/register returns 400 for invalid phone number', async () => {
    const { app } = await createApp()
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
        firstName: 'New',
        phone: 'abc',
        password: 'password123',
        token: 'some-token',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('format')
    expect(app.registration.createUser).not.toHaveBeenCalled()
  })

  it('POST /api/register returns 409 for duplicate email', async () => {
    const duplicateEmailError = Object.assign(new Error('Unique constraint failed on the fields: (`email`)'), {
      code: 'P2002',
      meta: { target: ['email'] },
    })

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
        firstName: 'Another',
        phone: '+375291234568',
        password: 'password123',
        token: 'some-token',
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({
      error: 'Электронная почта уже есть в системе',
    })
    expect(app.registration.verifyToken).toHaveBeenCalledWith('some-token')
    expect(auth.setSession).not.toHaveBeenCalled()
  })

  it('POST /api/register returns 409 for duplicate phone number', async () => {
    const duplicatePhoneError = Object.assign(new Error('Unique constraint failed on the fields: (`phone`)'), {
      code: 'P2002',
      meta: { target: ['phone'] },
    })

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
        firstName: 'New',
        phone: '+375291234569', // Duplicate phone
        password: 'password123',
        token: 'some-token',
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({
      error: 'Номер телефона уже есть в системе',
    })
    expect(app.registration.verifyToken).toHaveBeenCalledWith('some-token')
    expect(auth.setSession).not.toHaveBeenCalled()
  })

  it('POST /api/register returns 409 for duplicate invite code', async () => {
    const duplicateCodeError = Object.assign(new Error('Unique constraint failed on the fields: (`code`)'), {
      code: 'P2002',
      meta: { target: ['code'] },
    })

    const { app, auth } = await createApp({
      createUser: vi.fn().mockRejectedValue(duplicateCodeError),
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
        firstName: 'New',
        phone: '+375291234575',
        password: 'password123',
        token: 'some-token',
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({
      error: 'Приглашенный уже есть в системе',
    })
    expect(app.registration.verifyToken).toHaveBeenCalledWith('some-token')
    expect(auth.setSession).not.toHaveBeenCalled()
  })

  it('POST /api/register returns 409 with raw field name for unknown P2002 field', async () => {
    const unknownFieldError = Object.assign(new Error('Unique constraint failed on the fields: (`wallet`)'), {
      code: 'P2002',
      meta: { target: ['wallet'] },
    })

    const { app, auth } = await createApp({
      createUser: vi.fn().mockRejectedValue(unknownFieldError),
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
        firstName: 'New',
        phone: '+375291234576',
        password: 'password123',
        token: 'some-token',
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({
      error: 'wallet уже есть в системе',
    })
    expect(app.registration.verifyToken).toHaveBeenCalledWith('some-token')
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
        firstName: 'New',
        phone: '+375291234572',
        password: 'password123',
        token: 'some-token',
      },
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ error: 'Ошибка регистрации' })
    expect(app.registration.verifyToken).toHaveBeenCalledWith('some-token')
    expect(auth.setSession).not.toHaveBeenCalled()
  })

  it('POST /api/register returns 500 when parentId does not point to an existing user', async () => {
    const foreignKeyError = Object.assign(new Error('Foreign key constraint failed on the field: parentId'), {
      code: 'P2003',
    })

    const { app, auth } = await createApp({
      createUser: vi.fn().mockRejectedValue(foreignKeyError),
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
        firstName: 'New',
        phone: '+375291234577',
        password: 'password123',
        token: 'some-token',
      },
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ error: 'Foreign key constraint failed on the field: parentId' })
    expect(app.registration.verifyToken).toHaveBeenCalledWith('some-token')
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
        firstName: 'New',
        phone: '+375291234573',
        password: 'password123',
        token: 'some-token',
      },
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ error: 'Database connection error' })
    expect(app.registration.verifyToken).toHaveBeenCalledWith('some-token')
    expect(auth.setSession).not.toHaveBeenCalled()
  })

  it('POST /api/register returns 200 with success message on success', async () => {
    if (fs.existsSync(lastEmailFixturePath)) fs.unlinkSync(lastEmailFixturePath)

    const { app, auth } = await createApp({
      createUser: vi.fn().mockResolvedValue({
        id: 42,
        email: 'new.user@example.com',
        firstName: 'New',
      }),
    })
    apps.push(app)
    const { csrfToken, cookieHeader } = await getCsrfContext(app)

    const payload = {
      email: 'new.user@example.com',
      firstName: 'New',
      phone: '+375291234574',
      password: 'password123',
      token: 'some-token',
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
    expect(response.json()).toEqual({
      success: true,
      message: 'Регистрация прошла успешно',
    })
    expect(app.registration.createUser).toHaveBeenCalledWith({
      email: payload.email,
      firstName: payload.firstName,
      phone: payload.phone,
      password: payload.password,
      parentId: null,
      inviteCode: 'test-jti',
    })
    expect(app.registration.verifyToken).toHaveBeenCalledWith('some-token')
    expect(auth.setSession).not.toHaveBeenCalled()

    expect(fs.existsSync(lastEmailFixturePath)).toBe(true)
    const emailContent = JSON.parse(fs.readFileSync(lastEmailFixturePath, 'utf-8'))
    expect(emailContent.to).toBe(payload.email)
    expect(emailContent.subject).toBe('Добро пожаловать в Наш Дом!')
    expect(emailContent.text).toContain(`Здравствуйте ${payload.firstName}!`)
    expect(emailContent.text).toContain('/auth')
  })
})
