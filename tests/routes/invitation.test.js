import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import jwt from 'jsonwebtoken'
import { buildBackendApp } from '../../backend.js'

const SESSION_SECRET = 'test-secret-key-for-testing-purposes'

beforeAll(() => {
  vi.stubEnv('SESSION_SECRET', SESSION_SECRET)
})

const createApp = async (authOverrides = {}, prismaOverrides = {}) => {
  const app = await buildBackendApp({ logger: false })

  // Override CSRF protection with a no-op
  app.csrfProtection = (req, reply, next) => next()

  // Mock prisma decorator
  const defaultPrisma = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    company: {
      findFirst: vi.fn(),
    },
    usedInvite: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  }

  app.prisma = { ...defaultPrisma, ...prismaOverrides }

  // Mock auth functions
  const defaultAuth = {
    getUser: vi.fn().mockResolvedValue(null),
    register: vi.fn(),
    login: vi.fn(),
    setSession: vi.fn(),
    clearSession: vi.fn(),
    createTwoFactorCode: vi.fn(),
    verifyTwoFactorCode: vi.fn(),
    signPendingAuth: vi.fn(),
    verifyPendingAuth: vi.fn(),
  }

  for (const key in defaultAuth) {
    app.auth[key] = authOverrides[key] || defaultAuth[key]
  }

  return { app, auth: app.auth }
}

describe('POST /api/invitation/generate', () => {
  const apps = []

  afterEach(async () => {
    while (apps.length > 0) {
      const app = apps.pop()
      await app.close()
    }
  })

  it('returns 401 when user is not authenticated', async () => {
    const { app, auth } = await createApp({
      getUser: vi.fn().mockResolvedValue(null),
    })
    apps.push(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/invitation/generate',
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ error: 'Доступно только авторизованным пользователям' })
    expect(auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('returns a token with owner=null for Admin user', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      nick: 'admin',
    }

    const { app, auth } = await createApp({
      getUser: vi.fn().mockResolvedValue(adminUser),
    })
    apps.push(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/invitation/generate',
    })

    expect(response.statusCode).toBe(200)

    const body = response.json()
    expect(body).toHaveProperty('token')
    expect(typeof body.token).toBe('string')

    // Decode the JWT and verify its payload
    const decoded = jwt.verify(body.token, SESSION_SECRET)
    expect(decoded.owner).toBeNull()
    expect(decoded).toHaveProperty('inviteCode')
    expect(typeof decoded.inviteCode).toBe('string')
    expect(decoded.inviteCode).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    expect(decoded).toHaveProperty('exp')
    expect(decoded).toHaveProperty('iat')
    expect(auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('returns a token with owner=userId for non-Admin user', async () => {
    const consultantUser = {
      id: 5,
      email: 'consultant@example.com',
      role: 'Consultant',
      nick: 'consultant',
    }

    const { app, auth } = await createApp({
      getUser: vi.fn().mockResolvedValue(consultantUser),
    })
    apps.push(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/invitation/generate',
    })

    expect(response.statusCode).toBe(200)

    const body = response.json()
    expect(body).toHaveProperty('token')
    expect(typeof body.token).toBe('string')

    // Decode the JWT and verify its payload
    const decoded = jwt.verify(body.token, SESSION_SECRET)
    expect(decoded.owner).toBe(5)
    expect(decoded).toHaveProperty('inviteCode')
    expect(typeof decoded.inviteCode).toBe('string')
    expect(decoded.inviteCode).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    expect(decoded).toHaveProperty('exp')
    expect(decoded).toHaveProperty('iat')
    expect(auth.getUser).toHaveBeenCalledTimes(1)
  })
})
