import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import adminRoutes from '../../src/routes/admin.js'
import { WALLET_REGEXP, PHONE_REGEXP } from '../../src/lib/regexps.js'

const SESSION_SECRET = 'test-secret-key-for-testing-purposes'

beforeAll(() => {
  vi.stubEnv('SESSION_SECRET', SESSION_SECRET)
})

const createApp = async (authOverrides = {}, prismaOverrides = {}) => {
  const app = Fastify({
    logger: false,
    ajv: {
      plugins: [
        (ajv) => {
          ajv.addFormat('phone', PHONE_REGEXP)
          ajv.addFormat('wallet', WALLET_REGEXP)
        },
      ],
    },
  })

  // Mock prisma decorator
  const defaultPrisma = {
    company: {
      update: vi.fn(),
    },
  }

  app.decorate('prisma', { ...defaultPrisma, ...prismaOverrides })

  // Register cookie plugin (needed by auth decorator's getUser for cookie parsing)
  await app.register(cookie, { secret: SESSION_SECRET })

  // Mock csrf protection
  app.decorate('csrfProtection', (req, reply, next) => next())

  // Decorate with auth object
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

  app.decorate('auth', { ...defaultAuth, ...authOverrides })

  await app.register(adminRoutes)

  return { app, auth: app.auth }
}

describe('PUT /api/admin/company', () => {
  const apps = []

  afterEach(async () => {
    while (apps.length > 0) {
      const app = apps.pop()
      await app.close()
    }
  })

  it('returns 403 when user is not authenticated', async () => {
    const { app, auth } = await createApp({
      getUser: vi.fn().mockResolvedValue(null),
    })
    apps.push(app)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/company',
      payload: { name: 'Test Company' },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
    expect(auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('returns 403 when user is not Admin', async () => {
    const nonAdminUser = {
      id: 1,
      email: 'user@example.com',
      role: 'Candidate',
      company: { id: 1 },
    }

    const { app, auth } = await createApp({
      getUser: vi.fn().mockResolvedValue(nonAdminUser),
    })
    apps.push(app)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/company',
      payload: { name: 'Test Company' },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
    expect(auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('returns 400 when name is missing', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const { app } = await createApp({
      getUser: vi.fn().mockResolvedValue(adminUser),
    })
    apps.push(app)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/company',
      payload: {},
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('required')
  })

  it('returns 400 when primaryWallet has invalid format', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const { app } = await createApp({
      getUser: vi.fn().mockResolvedValue(adminUser),
    })
    apps.push(app)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/company',
      payload: {
        name: 'Test Company',
        primaryWallet: 'invalid-wallet',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('primaryWallet')
  })

  it('returns 400 when secondaryWallet has invalid format', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const { app } = await createApp({
      getUser: vi.fn().mockResolvedValue(adminUser),
    })
    apps.push(app)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/company',
      payload: {
        name: 'Test Company',
        secondaryWallet: 'invalid-wallet',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('secondaryWallet')
  })

  it('returns 409 when company name is already taken', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const mockError = new Error('Unique constraint failed')
    mockError.code = 'P2002'

    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(adminUser),
      },
      {
        company: {
          update: vi.fn().mockRejectedValue(mockError),
        },
      },
    )
    apps.push(app)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/company',
      payload: { name: 'Existing Company' },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Компания с таким названием уже существует' })
  })

  it('returns 500 on unexpected error', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(adminUser),
      },
      {
        company: {
          update: vi.fn().mockRejectedValue(new Error('Database connection failed')),
        },
      },
    )
    apps.push(app)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/company',
      payload: { name: 'Test Company' },
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ error: 'Ошибка обновления компании' })
  })

  it('returns 200 and updates company on success', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const updatedCompany = {
      id: 1,
      name: 'Updated Company',
      primaryWallet: '0x1234567890abcdef1234567890abcdef12345678',
      secondaryWallet: null,
    }

    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(adminUser),
      },
      {
        company: {
          update: vi.fn().mockResolvedValue(updatedCompany),
        },
      },
    )
    apps.push(app)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/company',
      payload: {
        name: 'Updated Company',
        primaryWallet: '0x1234567890abcdef1234567890abcdef12345678',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      success: true,
      company: {
        id: 1,
        name: 'Updated Company',
        primaryWallet: '0x1234567890abcdef1234567890abcdef12345678',
        secondaryWallet: null,
      },
    })
  })
})
