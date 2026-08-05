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
})
