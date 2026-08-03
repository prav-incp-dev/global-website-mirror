import fp from 'fastify-plugin'
import { createPublicClient, http, getAddress, formatUnits } from 'viem'

const erc20Abi = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
]

export default fp(async (server) => {
  server.decorate('user', {
    getBalance: async (wallet) => {
      if (!wallet) return null

      const usdtAddress = process.env.VITE_BSC_TESTNET_USDT_ADDRESS
      const rpcUrl = process.env.VITE_BSC_TESTNET_RPC_URL

      if (!usdtAddress || !rpcUrl) return null

      const publicClient = createPublicClient({
        transport: http(rpcUrl),
      })

      const [rawBalance, decimals] = await Promise.all([
        publicClient.readContract({
          address: getAddress(usdtAddress),
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [getAddress(wallet)],
        }),
        publicClient.readContract({
          address: getAddress(usdtAddress),
          abi: erc20Abi,
          functionName: 'decimals',
        }),
      ])

      return formatUnits(rawBalance, decimals)
    },
  })
})
