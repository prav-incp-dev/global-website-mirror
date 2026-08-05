import fp from 'fastify-plugin'
import { getAddress, formatUnits } from 'viem'
import { getPublicClient, usdtAddress } from '../lib/chain.js'

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

      if (!usdtAddress) return null

      const publicClient = getPublicClient()

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

    getChildren: async (user) => {
      const children = await server.prisma.$queryRaw`
        WITH RECURSIVE user_hierarchy AS (
          SELECT *
          FROM "User"
          WHERE "parentId" = ${user.id}

          UNION ALL

          SELECT u.*
          FROM "User" u
          INNER JOIN user_hierarchy uh ON u."parentId" = uh.id
        )
        SELECT * FROM user_hierarchy
      `

      return children
    },
  })
})
