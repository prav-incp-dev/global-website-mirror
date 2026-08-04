import { beforeAll, describe, it, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { createApp } from '../helpers'
import { parseUserId } from '@/plugins/auth'

const SESSION_SECRET = 'supersecret'

beforeAll(() => {
  vi.stubEnv('SESSION_SECRET', SESSION_SECRET)
})

describe('auth plugin core functionality', () => {
  it('parseUserId returns null for invalid input', ({ expect }) => {
    expect(parseUserId('abc')).toBeNull()
    expect(parseUserId('0')).toBeNull()
    expect(parseUserId('-1')).toBeNull()
    expect(parseUserId(null)).toBeNull()
    expect(parseUserId(undefined)).toBeNull()
  })

  it('parseUserId returns userId for valid input', ({ expect }) => {
    expect(parseUserId('123')).toBe(123)
    expect(parseUserId(123)).toBe(123)
  })

  it('login returns null for non-existent user', async ({ expect }) => {
    const app = await createApp()

    vi.spyOn(app.prisma.user, 'findUnique').mockResolvedValue(null)
    const user = await app.auth.login('test@example.com', 'password')
    expect(user).toBeNull()
  })

  it('login returns null for invalid password', async ({ expect }) => {
    const app = await createApp()

    vi.spyOn(app.prisma.user, 'findUnique').mockResolvedValue({
      password: await bcrypt.hash('wrongpassword', 10),
    })
    const user = await app.auth.login('test@example.com', 'password')
    expect(user).toBeNull()
  })

  it('login returns user for valid credentials', async ({ expect }) => {
    const app = await createApp()

    const hashedPassword = await bcrypt.hash('password', 10)
    const mockUser = { id: 1, email: 'test@example.com', password: hashedPassword, company: { name: 'Test Company' } }
    vi.spyOn(app.prisma.user, 'findUnique').mockResolvedValue(mockUser)
    const user = await app.auth.login('test@example.com', 'password')
    expect(user).toEqual({ id: 1, email: 'test@example.com', company: { name: 'Test Company' } })
  })

  it('setSession sets the session cookie', async ({ expect }) => {
    const app = await createApp()

    const replyMock = {
      setCookie: vi.fn(),
    }
    app.auth.setSession(replyMock, 1)
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

  it('clearSession clears the session cookie', async ({ expect }) => {
    const app = await createApp()

    const replyMock = {
      clearCookie: vi.fn(),
    }
    app.auth.clearSession(replyMock)
    expect(replyMock.clearCookie).toHaveBeenCalledWith('session', { path: '/' })
  })

  it('getUser returns null if no session cookie', async ({ expect }) => {
    const app = await createApp()

    const reqMock = { cookies: {} }
    const user = await app.auth.getUser(reqMock)
    expect(user).toBeNull()
  })

  it('getUser returns null if session cookie is invalid', async ({ expect }) => {
    const app = await createApp()

    const reqMock = {
      cookies: { session: 'invalid' },
      unsignCookie: vi.fn(() => ({ valid: false, value: null })),
    }
    const user = await app.auth.getUser(reqMock)
    expect(user).toBeNull()
  })

  it('getUser returns null if user does not exist', async ({ expect }) => {
    const app = await createApp()

    const reqMock = {
      cookies: { session: '1' },
      unsignCookie: vi.fn(() => ({ valid: true, value: '1' })),
    }
    vi.spyOn(app.prisma.user, 'findUnique').mockResolvedValue(null)
    const user = await app.auth.getUser(reqMock)
    expect(user).toBeNull()
  })

  it('getUser returns user if session cookie is valid and user exists', async ({ expect }) => {
    const app = await createApp()

    const reqMock = {
      cookies: { session: '1' },
      unsignCookie: vi.fn(() => ({ valid: true, value: '1' })),
    }
    const mockUser = { id: 1, email: 'test@example.com', password: 'hashedpassword', company: { name: 'Test Company' } }
    vi.spyOn(app.prisma.user, 'findUnique').mockResolvedValue(mockUser)
    const user = await app.auth.getUser(reqMock)
    expect(user).toEqual({ id: 1, email: 'test@example.com', company: { name: 'Test Company' } })
  })

  it('getUser returns user with parent info when parent exists', async ({ expect }) => {
    const app = await createApp()

    const reqMock = {
      cookies: { session: '1' },
      unsignCookie: vi.fn(() => ({ valid: true, value: '1' })),
    }
    const mockUser = {
      id: 2,
      email: 'test@example.com',
      password: 'hashedpassword',
      company: { name: 'Test Company' },
      parent: { id: 1, nick: 'parentNick', firstName: 'Parent', lastName: 'User' },
    }
    vi.spyOn(app.prisma.user, 'findUnique').mockResolvedValue(mockUser)
    const user = await app.auth.getUser(reqMock)
    expect(user).toEqual({
      id: 2,
      email: 'test@example.com',
      company: { name: 'Test Company' },
      parent: { id: 1, nick: 'parentNick', firstName: 'Parent', lastName: 'User' },
    })
  })

  it('getUser returns user with null parent when no parent exists', async ({ expect }) => {
    const app = await createApp()

    const reqMock = {
      cookies: { session: '1' },
      unsignCookie: vi.fn(() => ({ valid: true, value: '1' })),
    }
    const mockUser = {
      id: 2,
      email: 'test@example.com',
      password: 'hashedpassword',
      company: { name: 'Test Company' },
      parent: null,
    }
    vi.spyOn(app.prisma.user, 'findUnique').mockResolvedValue(mockUser)
    const user = await app.auth.getUser(reqMock)
    expect(user).toEqual({
      id: 2,
      email: 'test@example.com',
      company: { name: 'Test Company' },
      parent: null,
    })
  })

  it('createTwoFactorCode generates and stores a code', async ({ expect }) => {
    const app = await createApp()

    vi.spyOn(crypto, 'randomInt').mockReturnValue(123456)
    const mockUser = { id: 1 }
    vi.spyOn(app.prisma.user, 'update').mockResolvedValue(mockUser)
    const code = await app.auth.createTwoFactorCode(mockUser)
    expect(code).toBe('123456')
    expect(app.prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { confirmationCode: '123456' },
    })
  })

  it('verifyTwoFactorCode returns false for invalid userId', async ({ expect }) => {
    const app = await createApp()

    const result = await app.auth.verifyTwoFactorCode('abc', '123456')
    expect(result).toBe(false)
  })

  it('verifyTwoFactorCode returns false if user not found', async ({ expect }) => {
    const app = await createApp()

    vi.spyOn(app.prisma.user, 'findUnique').mockResolvedValue(null)
    const result = await app.auth.verifyTwoFactorCode(1, '123456')
    expect(result).toBe(false)
  })

  it('verifyTwoFactorCode returns false if no confirmationCode', async ({ expect }) => {
    const app = await createApp()

    vi.spyOn(app.prisma.user, 'findUnique').mockResolvedValue({ id: 1, confirmationCode: null })
    const result = await app.auth.verifyTwoFactorCode(1, '123456')
    expect(result).toBe(false)
  })

  it('verifyTwoFactorCode returns false for incorrect code', async ({ expect }) => {
    const app = await createApp()

    vi.spyOn(app.prisma.user, 'findUnique').mockResolvedValue({ id: 1, confirmationCode: '654321' })
    const result = await app.auth.verifyTwoFactorCode(1, '123456')
    expect(result).toBe(false)
  })

  it('verifyTwoFactorCode returns true for correct code and clears it', async ({ expect }) => {
    const app = await createApp()

    vi.spyOn(app.prisma.user, 'findUnique').mockResolvedValue({ id: 1, confirmationCode: '123456' })
    vi.spyOn(app.prisma.user, 'update').mockResolvedValue({ id: 1, confirmationCode: null })
    const result = await app.auth.verifyTwoFactorCode(1, '123456')
    expect(result).toBe(true)
    expect(app.prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { confirmationCode: null },
    })
  })

  it('signPendingAuth signs a JWT with userId and expiry', async ({ expect }) => {
    const app = await createApp()

    const token = app.auth.signPendingAuth(1, 600)
    const decoded = jwt.verify(token, SESSION_SECRET)
    expect(decoded.userId).toBe(1)
    expect(decoded.exp).toBeDefined()
  })

  it('verifyPendingAuth returns userId for valid token', async ({ expect }) => {
    const app = await createApp()

    const token = jwt.sign({ userId: 1 }, SESSION_SECRET, { expiresIn: '10m' })
    const userId = app.auth.verifyPendingAuth(token)
    expect(userId).toBe(1)
  })

  it('verifyPendingAuth returns null for invalid token', async ({ expect }) => {
    const app = await createApp()

    const userId = app.auth.verifyPendingAuth('invalidtoken')
    expect(userId).toBeNull()
  })

  it('verifyPendingAuth returns null for expired token', async ({ expect }) => {
    const app = await createApp()

    const token = jwt.sign({ userId: 1 }, SESSION_SECRET, { expiresIn: '0s' })
    // Wait for the token to expire
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const userId = app.auth.verifyPendingAuth(token)
    expect(userId).toBeNull()
  })
})

describe('csrfProtection hook', () => {
  it('does not block GET requests', async ({ expect }) => {
    const app = await createApp()

    vi.spyOn(app, 'csrfProtection')

    app.get('/csrf-test', async (_req, reply) => reply.send({ ok: true }))

    const res = await app.inject({ method: 'GET', url: '/csrf-test' })

    expect(res.statusCode).toBe(200)
    expect(app.csrfProtection).not.toHaveBeenCalled()
  })

  it('invokes csrfProtection for POST requests', async ({ expect }) => {
    const app = await createApp()

    vi.spyOn(app, 'csrfProtection')

    app.post('/csrf-test', async (_req, reply) => reply.send({ ok: true }))

    const res = await app.inject({ method: 'POST', url: '/csrf-test' })

    expect(app.csrfProtection).toHaveBeenCalled()
    expect(res.statusCode).toBe(403)
  })
})
