import { beforeAll, describe, it, onTestFinished, vi } from 'vitest'
import jwt from 'jsonwebtoken'
import { buildBackendApp } from '../../backend.js'

const SESSION_SECRET = 'test-secret'

beforeAll(() => {
  vi.stubEnv('SESSION_SECRET', SESSION_SECRET)
})

const createApp = async () => {
  const app = await buildBackendApp({
    logger: false,
  })
  onTestFinished(async () => {
    await app.close()
  })

  const mockPrisma = {
    company: {
      findFirst: vi.fn(),
    },
    user: {
      create: vi.fn(),
    },
    usedInvite: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  }

  app.prisma = mockPrisma

  return { app, prisma: mockPrisma }
}

describe('register plugin', () => {
  it('createUser creates a user and removes password from result', async ({ expect }) => {
    const { app, prisma } = await createApp()

    const mockCompany = { id: 1, name: 'Test Company' }
    prisma.company.findFirst.mockResolvedValue(mockCompany)

    let capturedUserCreateArgs = null
    let capturedUsedInviteCreateArgs = null

    prisma.$transaction.mockImplementation(async (cb) => {
      const tx = {
        user: {
          create: vi.fn().mockImplementation((args) => {
            capturedUserCreateArgs = args
            return {
              id: 1,
              email: args.data.email,
              password: args.data.password,
              role: args.data.role,
              nick: args.data.nick,
              firstName: args.data.firstName,
              lastName: args.data.lastName,
              phone: args.data.phone,
              memberId: args.data.memberId,
              companyId: args.data.companyId,
              company: mockCompany,
            }
          }),
        },
        usedInvite: {
          create: vi.fn().mockImplementation((args) => {
            capturedUsedInviteCreateArgs = args
            return { id: 1, code: args.data.code }
          }),
        },
      }
      return cb(tx)
    })

    const result = await app.registration.createUser({
      email: 'new.user@example.com',
      firstName: 'New',
      phone: '+10000000002',
      password: 'plainpassword',
      inviteCode: 'test-invite',
    })

    expect(capturedUserCreateArgs.data.password).not.toBe('plainpassword')
    expect(capturedUserCreateArgs.data.password).toBeDefined()

    expect(capturedUserCreateArgs.data).toMatchObject({
      email: 'new.user@example.com',
      firstName: 'New',
      phone: '+10000000002',
      role: 'Candidate',
      companyId: 1,
    })

    expect(capturedUsedInviteCreateArgs.data).toEqual({ code: 'test-invite' })

    expect(result).not.toHaveProperty('password')
    expect(result.email).toBe('new.user@example.com')

    expect(prisma.company.findFirst).toHaveBeenCalledWith({
      orderBy: { id: 'asc' },
    })
  })

  it('createUser throws error when inviteCode is already taken', async ({ expect }) => {
    const { app, prisma } = await createApp()

    const mockCompany = { id: 1, name: 'Test Company' }
    prisma.company.findFirst.mockResolvedValue(mockCompany)

    const p2002Error = Object.assign(new Error('Unique constraint failed on the fields: (`code`)'), {
      code: 'P2002',
    })

    prisma.$transaction.mockImplementation(async (cb) => {
      const tx = {
        user: { create: vi.fn() },
        usedInvite: { create: vi.fn().mockRejectedValue(p2002Error) },
      }
      return cb(tx)
    })

    await expect(
      app.registration.createUser({
        email: 'new.user@example.com',
        firstName: 'New',
        phone: '+10000000002',
        password: 'plainpassword',
        inviteCode: 'already-used-code',
      }),
    ).rejects.toThrow('Unique constraint failed')
  })

  it('createUser throws error when no company found', async ({ expect }) => {
    const { app, prisma } = await createApp()

    prisma.company.findFirst.mockResolvedValue(null)

    await expect(
      app.registration.createUser({
        email: 'new.user@example.com',
        firstName: 'New',
        phone: '+10000000002',
        password: 'plainpassword',
        inviteCode: 'test-invite',
      }),
    ).rejects.toThrow('No company found')
  })

  it('verifyToken returns inviteCode and owner for valid token', async ({ expect }) => {
    const { app, prisma } = await createApp()

    vi.spyOn(jwt, 'verify').mockReturnValue({ inviteCode: 'abc123', owner: 1 })
    prisma.usedInvite.findUnique.mockResolvedValue(null)

    const result = await app.registration.verifyToken('valid-token')

    expect(result).toEqual({ inviteCode: 'abc123', owner: 1 })
    expect(prisma.usedInvite.findUnique).toHaveBeenCalledWith({
      where: { code: 'abc123' },
    })
  })

  it('verifyToken throws error for invalid token (no inviteCode)', async ({ expect }) => {
    const { app } = await createApp()

    vi.spyOn(jwt, 'verify').mockReturnValue({ owner: '1' })

    await expect(app.registration.verifyToken('invalid-token')).rejects.toThrow('Invalid token')
  })

  it('verifyToken throws error when jwt.verify throws', async ({ expect }) => {
    const { app } = await createApp()

    vi.spyOn(jwt, 'verify').mockImplementation(() => {
      throw new Error('jwt malformed')
    })

    await expect(app.registration.verifyToken('malformed-token')).rejects.toThrow('jwt malformed')
  })

  it('verifyToken throws error when invite is already used', async ({ expect }) => {
    const { app, prisma } = await createApp()

    vi.spyOn(jwt, 'verify').mockReturnValue({ inviteCode: 'used-code', owner: '1' })
    prisma.usedInvite.findUnique.mockResolvedValue({ code: 'used-code' })

    await expect(app.registration.verifyToken('used-token')).rejects.toThrow('Invite already used')
  })
})
