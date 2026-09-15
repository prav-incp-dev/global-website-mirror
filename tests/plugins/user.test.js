import { describe, it, vi, beforeAll } from 'vitest'
import { createApp } from '../helpers'

vi.mock('../../src/lib/chain.js', () => {
  const readContract = vi.fn()
  return {
    getPublicClient: vi.fn(() => ({ readContract })),
    getWalletClient: vi.fn(),
    ensureChain: vi.fn(),
    rpcUrl: 'https://mock-rpc.example.com',
    chainId: 97,
    usdtAddress: '0x0000000000000000000000000000000000000001',
    usdtDecimals: 18,
    erc20Abi: [],
  }
})

beforeAll(() => {
  vi.stubEnv('VITE_BSC_USDT_ADDRESS', '0x0000000000000000000000000000000000000001')
  vi.stubEnv('VITE_BSC_RPC_URL', 'https://mock-rpc.example.com')
})

describe('user plugin', () => {
  it('getBalance returns null when wallet is falsy', async ({ expect }) => {
    const app = await createApp()

    const result = await app.user.getBalance(null)
    expect(result).toBeNull()
  })

  it('getBalance returns formatted USDT balance', async ({ expect }) => {
    const app = await createApp()
    const { getPublicClient } = await import('../../src/lib/chain.js')
    const mockClient = getPublicClient()

    mockClient.readContract
      .mockResolvedValueOnce(1000000000000000000n) // balanceOf: 1 USDT (18 decimals)
      .mockResolvedValueOnce(18) // decimals

    const result = await app.user.getBalance('0x1234567890abcdef1234567890abcdef11111111')

    expect(result).toBe('1')
    expect(getPublicClient).toHaveBeenCalled()
  })

  describe('getDescendants', () => {
    const baseUser = {
      password: 'hash',
      companyId: 1,
      role: 'Consultant',
    }

    it('returns empty array when user has no children', async ({ expect }) => {
      const app = await createApp()

      const parent = await app.prisma.user.create({
        data: {
          ...baseUser,
          email: `getDescendants-no-children-${Date.now()}@test.com`,
          phone: `+10000001${String(Date.now()).slice(-4)}`,
        },
      })

      const children = await app.user.getDescendants(parent)
      expect(children).toHaveLength(0)
    })

    it('returns direct children only', async ({ expect }) => {
      const app = await createApp()

      const parent = await app.prisma.user.create({
        data: {
          ...baseUser,
          email: `getDescendants-direct-parent-${Date.now()}@test.com`,
          phone: `+10000002${String(Date.now()).slice(-4)}`,
        },
      })

      const child = await app.prisma.user.create({
        data: {
          ...baseUser,
          email: `getDescendants-direct-child-${Date.now()}@test.com`,
          phone: `+10000003${String(Date.now()).slice(-4)}`,
          parentId: parent.id,
        },
      })

      const children = await app.user.getDescendants(parent)
      expect(children).toHaveLength(1)
      expect(children[0].id).toBe(child.id)
      expect(children[0].lastInteractionDate).toBeNull()
      expect(children[0].nextInteractionDate).toBeNull()
    })

    it('returns all descendants recursively', async ({ expect }) => {
      const app = await createApp()

      const parent = await app.prisma.user.create({
        data: {
          ...baseUser,
          email: `getDescendants-recursive-parent-${Date.now()}@test.com`,
          phone: `+10000004${String(Date.now()).slice(-4)}`,
        },
      })

      const child = await app.prisma.user.create({
        data: {
          ...baseUser,
          email: `getDescendants-recursive-child-${Date.now()}@test.com`,
          phone: `+10000005${String(Date.now()).slice(-4)}`,
          parentId: parent.id,
        },
      })

      const grandchild = await app.prisma.user.create({
        data: {
          ...baseUser,
          email: `getDescendants-recursive-grandchild-${Date.now()}@test.com`,
          phone: `+10000006${String(Date.now()).slice(-4)}`,
          parentId: child.id,
        },
      })

      const children = await app.user.getDescendants(parent)
      expect(children).toHaveLength(2)
      const childIds = children.map((c) => c.id)
      expect(childIds).toContain(child.id)
      expect(childIds).toContain(grandchild.id)
    })

    it('returns lastInteractionDate for closed interactions only', async ({ expect }) => {
      const app = await createApp()

      const parent = await app.prisma.user.create({
        data: {
          ...baseUser,
          email: `getDescendants-interaction-parent-${Date.now()}@test.com`,
          phone: `+10000007${String(Date.now()).slice(-4)}`,
        },
      })

      const child = await app.prisma.user.create({
        data: {
          ...baseUser,
          email: `getDescendants-interaction-child-${Date.now()}@test.com`,
          phone: `+10000008${String(Date.now()).slice(-4)}`,
          parentId: parent.id,
        },
      })

      const grandchild = await app.prisma.user.create({
        data: {
          ...baseUser,
          email: `getDescendants-interaction-grandchild-${Date.now()}@test.com`,
          phone: `+10000009${String(Date.now()).slice(-4)}`,
          parentId: child.id,
        },
      })

      const closedDate = new Date('2026-08-01T10:00:00Z')

      await app.prisma.interaction.create({
        data: {
          status: 'Closed',
          plannedAt: new Date('2026-07-28T10:00:00Z'),
          completedAt: closedDate,
          description: 'Closed interaction for child',
          initiatorId: parent.id,
          targetId: child.id,
        },
      })

      await app.prisma.interaction.create({
        data: {
          status: 'Open',
          plannedAt: new Date('2026-08-02T10:00:00Z'),
          completedAt: null,
          description: 'Open interaction for grandchild',
          initiatorId: parent.id,
          targetId: grandchild.id,
        },
      })

      const children = await app.user.getDescendants(parent)
      expect(children).toHaveLength(2)

      const childResult = children.find((c) => c.id === child.id)
      const grandchildResult = children.find((c) => c.id === grandchild.id)

      expect(childResult.lastInteractionDate).toEqual(closedDate)
      expect(childResult.nextInteractionDate).toBeNull()
      expect(grandchildResult.lastInteractionDate).toBeNull()
      expect(grandchildResult.nextInteractionDate).toEqual(new Date('2026-08-02T10:00:00Z'))
    })

    it('returns nextInteractionDate for open interactions only', async ({ expect }) => {
      const app = await createApp()

      const parent = await app.prisma.user.create({
        data: {
          ...baseUser,
          email: `getDescendants-next-interaction-parent-${Date.now()}@test.com`,
          phone: `+10000012${String(Date.now()).slice(-4)}`,
        },
      })

      const child = await app.prisma.user.create({
        data: {
          ...baseUser,
          email: `getDescendants-next-interaction-child-${Date.now()}@test.com`,
          phone: `+10000013${String(Date.now()).slice(-4)}`,
          parentId: parent.id,
        },
      })

      const plannedDate = new Date('2026-09-01T14:00:00Z')

      await app.prisma.interaction.create({
        data: {
          status: 'Open',
          plannedAt: plannedDate,
          completedAt: null,
          description: 'Planned interaction',
          initiatorId: parent.id,
          targetId: child.id,
        },
      })

      const children = await app.user.getDescendants(parent)
      expect(children).toHaveLength(1)
      expect(children[0].id).toBe(child.id)
      expect(children[0].lastInteractionDate).toBeNull()
      expect(children[0].nextInteractionDate).toEqual(plannedDate)
    })

    it('returns latest completedAt for multiple closed interactions', async ({ expect }) => {
      const app = await createApp()

      const parent = await app.prisma.user.create({
        data: {
          ...baseUser,
          email: `getDescendants-latest-parent-${Date.now()}@test.com`,
          phone: `+10000010${String(Date.now()).slice(-4)}`,
        },
      })

      const child = await app.prisma.user.create({
        data: {
          ...baseUser,
          email: `getDescendants-latest-child-${Date.now()}@test.com`,
          phone: `+10000011${String(Date.now()).slice(-4)}`,
          parentId: parent.id,
        },
      })

      const earlierDate = new Date('2026-07-01T10:00:00Z')
      const laterDate = new Date('2026-08-15T10:00:00Z')

      await app.prisma.interaction.create({
        data: {
          status: 'Closed',
          plannedAt: new Date('2026-06-28T10:00:00Z'),
          completedAt: earlierDate,
          description: 'Earlier closed interaction',
          initiatorId: parent.id,
          targetId: child.id,
        },
      })

      await app.prisma.interaction.create({
        data: {
          status: 'Closed',
          plannedAt: new Date('2026-08-01T10:00:00Z'),
          completedAt: laterDate,
          description: 'Later closed interaction',
          initiatorId: parent.id,
          targetId: child.id,
        },
      })

      const children = await app.user.getDescendants(parent)
      expect(children).toHaveLength(1)

      expect(children[0].id).toBe(child.id)
      expect(children[0].lastInteractionDate).toEqual(laterDate)
      expect(children[0].nextInteractionDate).toBeNull()
    })
  })

  describe('getScores', () => {
    const createCompany = async (app) => {
      return app.prisma.company.create({
        data: { name: `GetScores Company ${Date.now()}-${Math.random()}` },
      })
    }

    const createUser = async (app, companyId, role = 'Consultant') => {
      return app.prisma.user.create({
        data: {
          email: `get-scores-${Date.now()}-${Math.random()}@test.com`,
          password: 'hash',
          role,
          firstName: 'Score',
          lastName: 'User',
          phone: `+1000003${String(Date.now()).slice(-4)}${Math.floor(Math.random() * 10)}`,
          companyId,
        },
      })
    }

    it('returns zeros for a Candidate even if they have wages', async ({ expect }) => {
      const app = await createApp()
      const company = await createCompany(app)
      const candidate = await createUser(app, company.id, 'Candidate')

      await app.prisma.wage.create({
        data: {
          companyId: company.id,
          userId: candidate.id,
          score: 100,
          groupScore: 200,
          amount: 0,
        },
      })

      const result = await app.user.getScores(candidate)

      expect(result).toEqual({ score: 0, groupScore: 0 })
    })

    it('returns zeros for a Consultant with no wages', async ({ expect }) => {
      const app = await createApp()
      const company = await createCompany(app)
      const consultant = await createUser(app, company.id, 'Consultant')

      const result = await app.user.getScores(consultant)

      expect(result).toEqual({ score: 0, groupScore: 0 })
    })

    it('returns aggregated wage sums for a single wage', async ({ expect }) => {
      const app = await createApp()
      const company = await createCompany(app)
      const consultant = await createUser(app, company.id, 'Consultant')

      await app.prisma.wage.create({
        data: {
          companyId: company.id,
          userId: consultant.id,
          score: 10,
          groupScore: 20,
          amount: 0,
        },
      })

      const result = await app.user.getScores(consultant)

      expect(result).toEqual({ score: 10, groupScore: 20 })
    })

    it('sums score and groupScore across multiple wages', async ({ expect }) => {
      const app = await createApp()
      const company = await createCompany(app)
      const consultant = await createUser(app, company.id, 'Consultant')

      await app.prisma.wage.create({
        data: {
          companyId: company.id,
          userId: consultant.id,
          score: 10,
          groupScore: 20,
          amount: 0,
        },
      })
      await app.prisma.wage.create({
        data: {
          companyId: company.id,
          userId: consultant.id,
          score: 30,
          groupScore: 40,
          amount: 0,
        },
      })

      const result = await app.user.getScores(consultant)

      expect(result).toEqual({ score: 40, groupScore: 60 })
    })

    it('ignores other users wages', async ({ expect }) => {
      const app = await createApp()
      const company = await createCompany(app)
      const first = await createUser(app, company.id, 'Consultant')
      const second = await createUser(app, company.id, 'Consultant')

      await app.prisma.wage.create({
        data: {
          companyId: company.id,
          userId: first.id,
          score: 10,
          groupScore: 20,
          amount: 0,
        },
      })
      await app.prisma.wage.create({
        data: {
          companyId: company.id,
          userId: second.id,
          score: 50,
          groupScore: 60,
          amount: 0,
        },
      })

      const firstResult = await app.user.getScores(first)
      const secondResult = await app.user.getScores(second)

      expect(firstResult).toEqual({ score: 10, groupScore: 20 })
      expect(secondResult).toEqual({ score: 50, groupScore: 60 })
    })
  })
})
