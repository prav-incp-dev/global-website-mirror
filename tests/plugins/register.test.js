import { test, beforeAll, afterAll, vi } from 'vitest'
import Fastify from 'fastify'
import jwt from 'jsonwebtoken'
import registerPlugin from '../../src/plugins/register'

const SESSION_SECRET = 'test-secret'

describe('register plugin', () => {
  let fastifyInstance

  beforeAll(async () => {
    vi.stubEnv('SESSION_SECRET', SESSION_SECRET)
    fastifyInstance = Fastify()
    fastifyInstance.decorate('prisma', {
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
    })
    await fastifyInstance.register(registerPlugin)
  })

  afterAll(async () => {
    await fastifyInstance.close()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('createUser creates a user and removes password from result', async ({ expect }) => {
    const mockCompany = { id: 1, name: 'Test Company' }
    fastifyInstance.prisma.company.findFirst.mockResolvedValue(mockCompany)

    let capturedUserCreateArgs = null
    let capturedUsedInviteCreateArgs = null

    fastifyInstance.prisma.$transaction.mockImplementation(async (cb) => {
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
              fullName: args.data.fullName,
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

    const result = await fastifyInstance.registration.createUser({
      email: 'new@example.com',
      nick: 'newuser',
      fullName: 'New User',
      phone: '+10000000002',
      memberId: 'MBR-9001',
      password: 'plainpassword',
      inviteCode: 'test-invite',
    })

    // Verify password was actually hashed (not plaintext)
    expect(capturedUserCreateArgs.data.password).not.toBe('plainpassword')
    expect(capturedUserCreateArgs.data.password).toBeDefined()

    // Verify user.create was called with correct data
    expect(capturedUserCreateArgs.data).toMatchObject({
      email: 'new@example.com',
      nick: 'newuser',
      fullName: 'New User',
      phone: '+10000000002',
      memberId: 'MBR-9001',
      role: 'Candidate',
      companyId: 1,
    })

    // Verify usedInvite.create was called with the invite code
    expect(capturedUsedInviteCreateArgs.data).toEqual({ code: 'test-invite' })

    // Verify password is stripped from the result
    expect(result).not.toHaveProperty('password')
    expect(result.email).toBe('new@example.com')

    // Verify company lookup was called
    expect(fastifyInstance.prisma.company.findFirst).toHaveBeenCalledWith({
      orderBy: { id: 'asc' },
    })
  })

  test('createUser throws error when inviteCode is already taken', async ({ expect }) => {
    const mockCompany = { id: 1, name: 'Test Company' }
    fastifyInstance.prisma.company.findFirst.mockResolvedValue(mockCompany)

    const p2002Error = Object.assign(new Error('Unique constraint failed on the fields: (`code`)'), {
      code: 'P2002',
    })

    fastifyInstance.prisma.$transaction.mockImplementation(async (cb) => {
      const tx = {
        user: { create: vi.fn() },
        usedInvite: { create: vi.fn().mockRejectedValue(p2002Error) },
      }
      return cb(tx)
    })

    await expect(
      fastifyInstance.registration.createUser({
        email: 'new@example.com',
        nick: 'newuser',
        fullName: 'New User',
        phone: '+10000000002',
        memberId: 'MBR-9001',
        password: 'plainpassword',
        inviteCode: 'already-used-code',
      }),
    ).rejects.toThrow('Unique constraint failed')
  })

  test('createUser throws error when no company found', async ({ expect }) => {
    fastifyInstance.prisma.company.findFirst.mockResolvedValue(null)

    await expect(
      fastifyInstance.registration.createUser({
        email: 'new@example.com',
        nick: 'newuser',
        fullName: 'New User',
        phone: '+10000000002',
        memberId: 'MBR-9001',
        password: 'plainpassword',
        inviteCode: 'test-invite',
      }),
    ).rejects.toThrow('No company found')
  })

  test('verifyToken returns inviteCode and owner for valid token', async ({ expect }) => {
    vi.spyOn(jwt, 'verify').mockReturnValue({ inviteCode: 'abc123', owner: 'test@example.com' })
    fastifyInstance.prisma.usedInvite.findUnique.mockResolvedValue(null)

    const result = await fastifyInstance.registration.verifyToken('valid-token')

    expect(result).toEqual({ inviteCode: 'abc123', owner: 'test@example.com' })
    expect(fastifyInstance.prisma.usedInvite.findUnique).toHaveBeenCalledWith({
      where: { code: 'abc123' },
    })
  })

  test('verifyToken throws error for invalid token (no inviteCode)', async ({ expect }) => {
    vi.spyOn(jwt, 'verify').mockReturnValue({ owner: 'test@example.com' })

    await expect(fastifyInstance.registration.verifyToken('invalid-token')).rejects.toThrow('Invalid token')
  })

  test('verifyToken throws error when jwt.verify throws', async ({ expect }) => {
    vi.spyOn(jwt, 'verify').mockImplementation(() => {
      throw new Error('jwt malformed')
    })

    await expect(fastifyInstance.registration.verifyToken('malformed-token')).rejects.toThrow('jwt malformed')
  })

  test('verifyToken throws error when invite is already used', async ({ expect }) => {
    vi.spyOn(jwt, 'verify').mockReturnValue({ inviteCode: 'used-code', owner: 'test@example.com' })
    fastifyInstance.prisma.usedInvite.findUnique.mockResolvedValue({ code: 'used-code' })

    await expect(fastifyInstance.registration.verifyToken('used-token')).rejects.toThrow('Invite already used')
  })
})
