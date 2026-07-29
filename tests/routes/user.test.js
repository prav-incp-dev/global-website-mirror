import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { buildBackendApp } from '../../backend.js'
import { UserRole } from '../../src/generated/prisma/client'

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
    user: {
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

describe('PUT /api/user/profile', () => {
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
      url: '/api/user/profile',
      payload: {
        firstName: 'John',
        lastName: 'Doe',
        phone: '+375291234567',
        memberId: '1234',
      },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
    expect(auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('returns 403 when user is an Admin', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: UserRole.Admin,
    }

    const { app, auth } = await createApp({
      getUser: vi.fn().mockResolvedValue(adminUser),
    })
    apps.push(app)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/user/profile',
      payload: {
        firstName: 'John',
        lastName: 'Doe',
        phone: '+375291234567',
        memberId: '1234',
      },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
    expect(auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('returns 400 when firstName is missing', async () => {
    const regularUser = {
      id: 1,
      email: 'user@example.com',
      role: UserRole.Candidate,
    }

    const { app } = await createApp({
      getUser: vi.fn().mockResolvedValue(regularUser),
    })
    apps.push(app)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/user/profile',
      payload: {
        lastName: 'Doe',
        phone: '+375291234567',
        memberId: '1234',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('required')
  })

  it('returns 400 when lastName is missing', async () => {
    const regularUser = {
      id: 1,
      email: 'user@example.com',
      role: UserRole.Candidate,
    }

    const { app } = await createApp({
      getUser: vi.fn().mockResolvedValue(regularUser),
    })
    apps.push(app)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/user/profile',
      payload: {
        firstName: 'John',
        phone: '+375291234567',
        memberId: '1234',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('required')
  })

  it('returns 400 when phone is missing', async () => {
    const regularUser = {
      id: 1,
      email: 'user@example.com',
      role: UserRole.Candidate,
    }

    const { app } = await createApp({
      getUser: vi.fn().mockResolvedValue(regularUser),
    })
    apps.push(app)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/user/profile',
      payload: {
        firstName: 'John',
        lastName: 'Doe',
        memberId: '1234',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('required')
  })

  it('returns 400 when memberId is missing', async () => {
    const regularUser = {
      id: 1,
      email: 'user@example.com',
      role: UserRole.Candidate,
    }

    const { app } = await createApp({
      getUser: vi.fn().mockResolvedValue(regularUser),
    })
    apps.push(app)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/user/profile',
      payload: {
        firstName: 'John',
        lastName: 'Doe',
        phone: '+375291234567',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('required')
  })

  it('returns 400 for invalid phone format', async () => {
    const regularUser = {
      id: 1,
      email: 'user@example.com',
      role: UserRole.Candidate,
    }

    const { app } = await createApp({
      getUser: vi.fn().mockResolvedValue(regularUser),
    })
    apps.push(app)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/user/profile',
      payload: {
        firstName: 'John',
        lastName: 'Doe',
        phone: 'invalid-phone',
        memberId: '1234',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('format')
  })

  it('returns 400 for invalid wallet format', async () => {
    const regularUser = {
      id: 1,
      email: 'user@example.com',
      role: UserRole.Candidate,
    }

    const { app } = await createApp({
      getUser: vi.fn().mockResolvedValue(regularUser),
    })
    apps.push(app)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/user/profile',
      payload: {
        firstName: 'John',
        lastName: 'Doe',
        phone: '+375291234567',
        memberId: '1234',
        wallet: 'invalid-wallet',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('format')
  })

  it('returns 400 for invalid memberId format', async () => {
    const regularUser = {
      id: 1,
      email: 'user@example.com',
      role: UserRole.Candidate,
    }

    const { app } = await createApp({
      getUser: vi.fn().mockResolvedValue(regularUser),
    })
    apps.push(app)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/user/profile',
      payload: {
        firstName: 'John',
        lastName: 'Doe',
        phone: '+375291234567',
        memberId: 'not-4-digits',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('format')
  })

  it('returns 409 for duplicate memberId', async () => {
    const regularUser = {
      id: 1,
      email: 'user@example.com',
      role: UserRole.Candidate,
    }

    const duplicateMemberIdError = Object.assign(new Error('Unique constraint failed on the fields: (`memberId`)'), {
      code: 'P2002',
      meta: { target: ['memberId'] },
    })

    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(regularUser),
      },
      {
        user: {
          update: vi.fn().mockRejectedValue(duplicateMemberIdError),
        },
      },
    )
    apps.push(app)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/user/profile',
      payload: {
        firstName: 'John',
        lastName: 'Doe',
        phone: '+375291234567',
        memberId: '1111',
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Номер пайщика уже есть в системе' })
  })

  it('returns 409 for duplicate nick', async () => {
    const regularUser = {
      id: 1,
      email: 'user@example.com',
      role: UserRole.Candidate,
    }

    const duplicateNickError = Object.assign(new Error('Unique constraint failed on the fields: (`nick`)'), {
      code: 'P2002',
      meta: { target: ['nick'] },
    })

    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(regularUser),
      },
      {
        user: {
          update: vi.fn().mockRejectedValue(duplicateNickError),
        },
      },
    )
    apps.push(app)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/user/profile',
      payload: {
        firstName: 'John',
        lastName: 'Doe',
        phone: '+375291234567',
        memberId: '1234',
        nick: 'existing-nick',
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Ник уже есть в системе' })
  })

  it('returns 409 for duplicate wallet', async () => {
    const regularUser = {
      id: 1,
      email: 'user@example.com',
      role: UserRole.Candidate,
    }

    const duplicateWalletError = Object.assign(new Error('Unique constraint failed on the fields: (`wallet`)'), {
      code: 'P2002',
      meta: { target: ['wallet'] },
    })

    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(regularUser),
      },
      {
        user: {
          update: vi.fn().mockRejectedValue(duplicateWalletError),
        },
      },
    )
    apps.push(app)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/user/profile',
      payload: {
        firstName: 'John',
        lastName: 'Doe',
        phone: '+375291234567',
        memberId: '1234',
        wallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Кошелек уже есть в системе' })
  })

  it('returns 500 on unexpected database error', async () => {
    const regularUser = {
      id: 1,
      email: 'user@example.com',
      role: UserRole.Candidate,
    }

    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(regularUser),
      },
      {
        user: {
          update: vi.fn().mockRejectedValue(new Error('Database connection failed')),
        },
      },
    )
    apps.push(app)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/user/profile',
      payload: {
        firstName: 'John',
        lastName: 'Doe',
        phone: '+375291234567',
        memberId: '1234',
      },
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ error: 'Ошибка обновления профиля' })
  })

  it('returns 200 and updates profile on success with all fields', async () => {
    const regularUser = {
      id: 1,
      email: 'user@example.com',
      role: UserRole.Candidate,
    }

    const updatedUser = {
      id: 1,
      firstName: 'Jane',
      lastName: 'Smith',
      phone: '+375297654321',
      memberId: '4567',
      nick: 'janesmith',
      wallet: '0x1234567890abcdef1234567890abcdef12345678',
    }

    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(regularUser),
      },
      {
        user: {
          update: vi.fn().mockResolvedValue(updatedUser),
        },
      },
    )
    apps.push(app)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/user/profile',
      payload: {
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+375297654321',
        memberId: '4567',
        nick: 'janesmith',
        wallet: '0x1234567890abcdef1234567890abcdef12345678',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      success: true,
      profile: updatedUser,
    })
    expect(app.prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+375297654321',
        memberId: '4567',
        nick: 'janesmith',
        wallet: '0x1234567890abcdef1234567890abcdef12345678',
      },
    })
  })

  it('returns 200 and updates profile on success with only required fields', async () => {
    const regularUser = {
      id: 1,
      email: 'user@example.com',
      role: UserRole.Candidate,
    }

    const updatedUser = {
      id: 1,
      firstName: 'Jane',
      lastName: 'Smith',
      phone: '+375297654321',
      memberId: '4567',
      nick: null,
      wallet: null,
    }

    const { app } = await createApp(
      {
        getUser: vi.fn().mockResolvedValue(regularUser),
      },
      {
        user: {
          update: vi.fn().mockResolvedValue(updatedUser),
        },
      },
    )
    apps.push(app)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/user/profile',
      payload: {
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+375297654321',
        memberId: '4567',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      success: true,
      profile: updatedUser,
    })
    expect(app.prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+375297654321',
        memberId: '4567',
        nick: null,
        wallet: null,
      },
    })
  })
})
