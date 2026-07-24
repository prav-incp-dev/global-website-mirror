import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { buildBackendApp } from '../../backend.js'

const SESSION_SECRET = 'test-secret-key-for-testing-purposes'

beforeAll(() => {
  vi.stubEnv('SESSION_SECRET', SESSION_SECRET)
})

const createApp = async (authOverrides = {}, prismaOverrides = {}) => {
  const app = await buildBackendApp({ logger: false })

  // Override CSRF protection with a no-op so we don't need tokens in tests
  app.csrfProtection = (req, reply, next) => next()

  // Mock prisma decorator
  const defaultPrisma = {
    company: {
      findUnique: vi.fn(),
      update: vi.fn(),
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

describe('admin plugin', () => {
  const apps = []

  afterEach(async () => {
    while (apps.length > 0) {
      const app = apps.pop()
      await app.close()
    }
  })

  it('getCompany returns null when user has no company', async () => {
    const adminUser = {
      id: 1,
      email: '[EMAIL]',
      role: 'Admin',
      company: null,
    }

    const { app } = await createApp({
      getUser: vi.fn().mockResolvedValue(adminUser),
    })
    apps.push(app)

    const company = await app.admin.getCompany(adminUser)

    expect(company).toBeNull()
  })

  it('getCompany returns null when user is null', async () => {
    const { app } = await createApp({
      getUser: vi.fn().mockResolvedValue(null),
    })
    apps.push(app)

    const company = await app.admin.getCompany(null)

    expect(company).toBeNull()
  })

  it('getCompany returns company data', async () => {
    const adminUser = {
      id: 1,
      email: '[EMAIL]',
      role: 'Admin',
      company: { id: 1 },
    }

    const foundCompany = {
      id: 1,
      name: 'Our House MLM',
      primaryWallet: '0x1234567890abcdef1234567890abcdef12345678',
      secondaryWallet: null,
    }

    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(adminUser),
      },
      {
        company: {
          findUnique: vi.fn().mockResolvedValue(foundCompany),
        },
      },
    )
    apps.push(app)

    const company = await app.admin.getCompany(adminUser)

    expect(company).toEqual(foundCompany)
    expect(app.prisma.company.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
    })
  })
})
