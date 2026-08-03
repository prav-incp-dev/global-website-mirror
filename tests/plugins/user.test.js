import { describe, it, vi, beforeAll } from 'vitest'
import { createApp } from '../helpers'

vi.mock('viem', () => {
  const actualFormatUnits = (value, decimals) => String(Number(value) / 10 ** Number(decimals))

  return {
    createPublicClient: vi.fn(() => ({
      readContract: vi.fn(),
    })),
    http: vi.fn(() => 'mock-transport'),
    getAddress: vi.fn((addr) => addr),
    formatUnits: vi.fn((value, decimals) => actualFormatUnits(value, decimals)),
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
    const { createPublicClient } = await import('viem')

    const readContractMock = vi
      .fn()
      .mockResolvedValueOnce(1000000000000000000n) // balanceOf: 1 USDT (18 decimals)
      .mockResolvedValueOnce(18) // decimals

    createPublicClient.mockReturnValue({ readContract: readContractMock })

    const result = await app.user.getBalance('0x1234567890abcdef1234567890abcdef11111111')

    expect(result).toBe('1')
    expect(createPublicClient).toHaveBeenCalled()
  })
})
