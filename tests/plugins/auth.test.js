import { test, beforeAll, afterEach, afterAll, vi } from 'vitest'
import Fastify from 'fastify'
import authPlugin, { parseUserId } from '../../src/plugins/auth'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'

// Mock csrf-protection as a noop to prevent double-decoration conflicts across describe blocks
vi.mock('@fastify/csrf-protection', () => ({
  default: async () => {},
}))

const SESSION_SECRET = 'supersecret'

let fastifyInstance
let onRequestHook
let csrfProtectionMock

beforeAll(async () => {
  vi.stubEnv('SESSION_SECRET', SESSION_SECRET)
})

afterEach(() => {
  vi.clearAllMocks()
})

afterAll(async () => {
  if (fastifyInstance) {
    await fastifyInstance.close()
  }
})

describe('auth plugin core functionality', () => {
  beforeAll(async () => {
    fastifyInstance = Fastify()
    fastifyInstance.decorate('prisma', {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
      company: {
        findFirst: vi.fn(),
      },
    })
    await fastifyInstance.register(authPlugin)
  })

  afterAll(async () => {
    await fastifyInstance.close()
  })

  test('parseUserId returns null for invalid input', ({ expect }) => {
    expect(parseUserId('abc')).toBeNull()
    expect(parseUserId('0')).toBeNull()
    expect(parseUserId('-1')).toBeNull()
    expect(parseUserId(null)).toBeNull()
    expect(parseUserId(undefined)).toBeNull()
  })

  test('parseUserId returns userId for valid input', ({ expect }) => {
    expect(parseUserId('123')).toBe(123)
    expect(parseUserId(123)).toBe(123)
  })

  test('login returns null for non-existent user', async ({ expect }) => {
    fastifyInstance.prisma.user.findUnique.mockResolvedValue(null)
    const user = await fastifyInstance.auth.login('test@example.com', 'password')
    expect(user).toBeNull()
  })

  test('login returns null for invalid password', async ({ expect }) => {
    fastifyInstance.prisma.user.findUnique.mockResolvedValue({
      password: await bcrypt.hash('wrongpassword', 10),
    })
    const user = await fastifyInstance.auth.login('test@example.com', 'password')
    expect(user).toBeNull()
  })

  test('login returns user for valid credentials', async ({ expect }) => {
    const hashedPassword = await bcrypt.hash('password', 10)
    const mockUser = { id: 1, email: 'test@example.com', password: hashedPassword, company: { name: 'Test Company' } }
    fastifyInstance.prisma.user.findUnique.mockResolvedValue(mockUser)
    const user = await fastifyInstance.auth.login('test@example.com', 'password')
    expect(user).toEqual({ id: 1, email: 'test@example.com', company: { name: 'Test Company' } })
  })

  test('setSession sets the session cookie', async ({ expect }) => {
    const replyMock = {
      setCookie: vi.fn(),
    }
    fastifyInstance.auth.setSession(replyMock, 1)
    expect(replyMock.setCookie).toHaveBeenCalledWith(
      'session',
      '1',
      expect.objectContaining({
        path: '/',
        httpOnly: true,
        sameSite: true,
        signed: true,
        secure: false,
        maxAge: 604800,
      }),
    )
  })

  test('clearSession clears the session cookie', async ({ expect }) => {
    const replyMock = {
      clearCookie: vi.fn(),
    }
    fastifyInstance.auth.clearSession(replyMock)
    expect(replyMock.clearCookie).toHaveBeenCalledWith('session', { path: '/' })
  })

  test('getUser returns null if no session cookie', async ({ expect }) => {
    const reqMock = { cookies: {} }
    const user = await fastifyInstance.auth.getUser(reqMock)
    expect(user).toBeNull()
  })

  test('getUser returns null if session cookie is invalid', async ({ expect }) => {
    const reqMock = {
      cookies: { session: 'invalid' },
      unsignCookie: vi.fn(() => ({ valid: false, value: null })),
    }
    const user = await fastifyInstance.auth.getUser(reqMock)
    expect(user).toBeNull()
  })

  test('getUser returns null if user does not exist', async ({ expect }) => {
    const reqMock = {
      cookies: { session: '1' },
      unsignCookie: vi.fn(() => ({ valid: true, value: '1' })),
    }
    fastifyInstance.prisma.user.findUnique.mockResolvedValue(null)
    const user = await fastifyInstance.auth.getUser(reqMock)
    expect(user).toBeNull()
  })

  test('getUser returns user if session cookie is valid and user exists', async ({ expect }) => {
    const reqMock = {
      cookies: { session: '1' },
      unsignCookie: vi.fn(() => ({ valid: true, value: '1' })),
    }
    const mockUser = { id: 1, email: 'test@example.com', password: 'hashedpassword', company: { name: 'Test Company' } }
    fastifyInstance.prisma.user.findUnique.mockResolvedValue(mockUser)
    const user = await fastifyInstance.auth.getUser(reqMock)
    expect(user).toEqual({ id: 1, email: 'test@example.com', company: { name: 'Test Company' } })
  })

  test('createTwoFactorCode generates and stores a code', async ({ expect }) => {
    vi.spyOn(crypto, 'randomInt').mockReturnValue(123456)
    const mockUser = { id: 1 }
    fastifyInstance.prisma.user.update.mockResolvedValue(mockUser)
    const code = await fastifyInstance.auth.createTwoFactorCode(mockUser)
    expect(code).toBe('123456')
    expect(fastifyInstance.prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { confirmationCode: '123456' },
    })
  })

  test('verifyTwoFactorCode returns false for invalid userId', async ({ expect }) => {
    const result = await fastifyInstance.auth.verifyTwoFactorCode('abc', '123456')
    expect(result).toBe(false)
  })

  test('verifyTwoFactorCode returns false if user not found', async ({ expect }) => {
    fastifyInstance.prisma.user.findUnique.mockResolvedValue(null)
    const result = await fastifyInstance.auth.verifyTwoFactorCode(1, '123456')
    expect(result).toBe(false)
  })

  test('verifyTwoFactorCode returns false if no confirmationCode', async ({ expect }) => {
    fastifyInstance.prisma.user.findUnique.mockResolvedValue({ id: 1, confirmationCode: null })
    const result = await fastifyInstance.auth.verifyTwoFactorCode(1, '123456')
    expect(result).toBe(false)
  })

  test('verifyTwoFactorCode returns false for incorrect code', async ({ expect }) => {
    fastifyInstance.prisma.user.findUnique.mockResolvedValue({ id: 1, confirmationCode: '654321' })
    const result = await fastifyInstance.auth.verifyTwoFactorCode(1, '123456')
    expect(result).toBe(false)
  })

  test('verifyTwoFactorCode returns true for correct code and clears it', async ({ expect }) => {
    fastifyInstance.prisma.user.findUnique.mockResolvedValue({ id: 1, confirmationCode: '123456' })
    fastifyInstance.prisma.user.update.mockResolvedValue({ id: 1, confirmationCode: null })
    const result = await fastifyInstance.auth.verifyTwoFactorCode(1, '123456')
    expect(result).toBe(true)
    expect(fastifyInstance.prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { confirmationCode: null },
    })
  })

  test('signPendingAuth signs a JWT with userId and expiry', async ({ expect }) => {
    const token = fastifyInstance.auth.signPendingAuth(1)
    const decoded = jwt.verify(token, SESSION_SECRET)
    expect(decoded.userId).toBe(1)
    expect(decoded.exp).toBeDefined()
  })

  test('verifyPendingAuth returns userId for valid token', async ({ expect }) => {
    const token = jwt.sign({ userId: 1 }, SESSION_SECRET, { expiresIn: '10m' })
    const userId = fastifyInstance.auth.verifyPendingAuth(token)
    expect(userId).toBe(1)
  })

  test('verifyPendingAuth returns null for invalid token', async ({ expect }) => {
    const userId = fastifyInstance.auth.verifyPendingAuth('invalidtoken')
    expect(userId).toBeNull()
  })

  test('verifyPendingAuth returns null for expired token', async ({ expect }) => {
    const token = jwt.sign({ userId: 1 }, SESSION_SECRET, { expiresIn: '0s' })
    // Wait for the token to expire
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const userId = fastifyInstance.auth.verifyPendingAuth(token)
    expect(userId).toBeNull()
  })

})

describe('csrfProtection hook', () => {
  beforeAll(async () => {
    fastifyInstance = Fastify()
    fastifyInstance.decorate('prisma', {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    })

    csrfProtectionMock = vi.fn((req, reply, next) => next())
    fastifyInstance.decorate('csrfProtection', csrfProtectionMock)

    fastifyInstance.addHook = vi.fn((hookName, handler) => {
      if (hookName === 'onRequest') {
        onRequestHook = handler
      }
    })

    await fastifyInstance.register(authPlugin)
  })

  afterAll(async () => {
    await fastifyInstance.close()
  })

  test('csrfProtection hook calls next for safe methods', async ({ expect }) => {
    const nextMock = vi.fn()
    const reqMock = { method: 'GET' }
    const replyMock = {}

    await onRequestHook(reqMock, replyMock, nextMock)

    expect(nextMock).toHaveBeenCalledOnce()
    expect(csrfProtectionMock).not.toHaveBeenCalled()
  })

  test('csrfProtection hook calls csrfProtection for unsafe methods', async ({ expect }) => {
    const nextMock = vi.fn()
    const reqMock = { method: 'POST' }
    const replyMock = {}

    await onRequestHook(reqMock, replyMock, nextMock)

    expect(csrfProtectionMock).toHaveBeenCalledWith(reqMock, replyMock, nextMock)
    expect(nextMock).toHaveBeenCalledOnce()
  })
})
