import fp from 'fastify-plugin'
import { getAddress, formatUnits } from 'viem'
import { getPublicClient, usdtAddress } from '../lib/chain.js'
import { UserRole } from '../generated/prisma/client'

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

    getDescendants: async (user) => {
      if (user.role === UserRole.Candidate) return []

      const children = await server.prisma.$queryRaw`
        WITH RECURSIVE user_hierarchy AS (
          SELECT *
          FROM "User"
          WHERE "parentId" = ${user.id}

          UNION ALL

          SELECT u.*
          FROM "User" u
          INNER JOIN user_hierarchy uh ON u."parentId" = uh.id
        ),
        last_interactions AS (
          SELECT
            "targetId",
            MAX("completedAt") AS "lastInteractionDate"
          FROM "Interaction"
          WHERE "status" = 'Closed'
          GROUP BY "targetId"
        ),
        next_interactions AS (
          SELECT
            "targetId",
            "plannedAt"
          FROM "Interaction"
          WHERE "status" = 'Open'
        )
        SELECT uh.*, li."lastInteractionDate", ni."plannedAt" AS "nextInteractionDate"
        FROM user_hierarchy uh
        LEFT JOIN last_interactions li ON li."targetId" = uh.id
        LEFT JOIN next_interactions ni ON ni."targetId" = uh.id
      `

      return children
    },
  })
})
