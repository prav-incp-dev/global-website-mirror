import { describe, it, vi, beforeAll, onTestFinished } from 'vitest'
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
  vi.stubEnv('VITE_BSC_TESTNET_USDT_ADDRESS', '0x0000000000000000000000000000000000000001')
  vi.stubEnv('VITE_BSC_TESTNET_RPC_URL', 'https://mock-rpc.example.com')
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
      role: 'Candidate',
    }

    let createdIds = []
    const withCleanup = (createFn) => {
      return async (...args) => {
        const result = await createFn(...args)
        createdIds.push(result.id)
        return result
      }
    }

    it('returns empty array when user has no children', async ({ expect }) => {
      const app = await createApp()
      onTestFinished(async () => {
        await app.prisma.user.deleteMany({ where: { id: { in: createdIds } } })
        createdIds = []
      })

      const parent = await withCleanup((data) => app.prisma.user.create({ data }))({
        ...baseUser,
        email: `getDescendants-no-children-${Date.now()}@test.com`,
        phone: `+10000001${String(Date.now()).slice(-4)}`,
      })

      const children = await app.user.getDescendants(parent)
      expect(children).toHaveLength(0)
    })

    it('returns direct children only', async ({ expect }) => {
      const app = await createApp()
      onTestFinished(async () => {
        await app.prisma.user.deleteMany({ where: { id: { in: createdIds } } })
        createdIds = []
      })

      const parent = await withCleanup((data) => app.prisma.user.create({ data }))({
        ...baseUser,
        email: `getDescendants-direct-parent-${Date.now()}@test.com`,
        phone: `+10000002${String(Date.now()).slice(-4)}`,
      })

      const child = await withCleanup((data) => app.prisma.user.create({ data }))({
        ...baseUser,
        email: `getDescendants-direct-child-${Date.now()}@test.com`,
        phone: `+10000003${String(Date.now()).slice(-4)}`,
        parentId: parent.id,
      })

      const children = await app.user.getDescendants(parent)
      expect(children).toHaveLength(1)
      expect(children[0].id).toBe(child.id)
    })

    it('returns all descendants recursively', async ({ expect }) => {
      const app = await createApp()
      onTestFinished(async () => {
        await app.prisma.user.deleteMany({ where: { id: { in: createdIds } } })
        createdIds = []
      })

      const parent = await withCleanup((data) => app.prisma.user.create({ data }))({
        ...baseUser,
        email: `getDescendants-recursive-parent-${Date.now()}@test.com`,
        phone: `+10000004${String(Date.now()).slice(-4)}`,
      })

      const child = await withCleanup((data) => app.prisma.user.create({ data }))({
        ...baseUser,
        email: `getDescendants-recursive-child-${Date.now()}@test.com`,
        phone: `+10000005${String(Date.now()).slice(-4)}`,
        parentId: parent.id,
      })

      const grandchild = await withCleanup((data) => app.prisma.user.create({ data }))({
        ...baseUser,
        email: `getDescendants-recursive-grandchild-${Date.now()}@test.com`,
        phone: `+10000006${String(Date.now()).slice(-4)}`,
        parentId: child.id,
      })

      const children = await app.user.getDescendants(parent)
      expect(children).toHaveLength(2)
      const childIds = children.map((c) => c.id)
      expect(childIds).toContain(child.id)
      expect(childIds).toContain(grandchild.id)
    })
  })
})
