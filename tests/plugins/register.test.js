import { test, beforeAll, afterAll, vi } from 'vitest'
import Fastify from 'fastify'
import registerPlugin from '../../src/plugins/register'

describe('register plugin', () => {
  let fastifyInstance

  beforeAll(async () => {
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
    const mockCreatedUser = {
      id: 1,
      email: 'new@example.com',
      password: 'hashed-password',
      role: 'Candidate',
      nick: 'newuser',
      fullName: 'New User',
      phone: '+10000000002',
      memberId: 'MBR-9001',
      companyId: 1,
      company: mockCompany,
    }
    fastifyInstance.prisma.$transaction.mockImplementation(async (cb) => {
      const tx = {
        user: { create: vi.fn().mockResolvedValue(mockCreatedUser) },
        usedInvite: { create: vi.fn().mockResolvedValue({ id: 1, code: 'test-invite' }) },
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

    expect(result).not.toHaveProperty('password')
    expect(result.email).toBe('new@example.com')
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
})
