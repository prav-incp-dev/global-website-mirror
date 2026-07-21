import { test, beforeAll, afterAll, vi } from 'vitest'
import Fastify from 'fastify'
import registerPlugin from '../../src/plugins/register'

describe('register plugin', () => {
  let fastifyInstance

  beforeAll(async () => {
    fastifyInstance = Fastify()
    fastifyInstance.decorate('db', {
      user: {
        create: vi.fn(),
      },
      company: {
        findFirst: vi.fn(),
      },
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
    fastifyInstance.db.company.findFirst.mockResolvedValue(mockCompany)
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
    fastifyInstance.db.user.create.mockResolvedValue(mockCreatedUser)

    const result = await fastifyInstance.registration.createUser({
      email: 'new@example.com',
      nick: 'newuser',
      fullName: 'New User',
      phone: '+10000000002',
      memberId: 'MBR-9001',
      password: 'plainpassword',
    })

    expect(result).not.toHaveProperty('password')
    expect(result.email).toBe('new@example.com')
    expect(fastifyInstance.db.company.findFirst).toHaveBeenCalledWith({
      orderBy: { id: 'asc' },
    })
    expect(fastifyInstance.db.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'new@example.com',
        role: 'Candidate',
        companyId: 1,
      }),
      include: { company: true },
    })
  })

  test('createUser throws error when no company found', async ({ expect }) => {
    fastifyInstance.db.company.findFirst.mockResolvedValue(null)

    await expect(
      fastifyInstance.registration.createUser({
        email: 'new@example.com',
        nick: 'newuser',
        fullName: 'New User',
        phone: '+10000000002',
        memberId: 'MBR-9001',
        password: 'plainpassword',
      }),
    ).rejects.toThrow('No company found')
  })
})
