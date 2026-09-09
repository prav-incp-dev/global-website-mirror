import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../src/generated/prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '..', '.env.test'), override: true })

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is not set')
}

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

const passwordHashRounds = 12
const testPasswordHash = bcrypt.hashSync('password', passwordHashRounds)

/**
 * Resets the test database to a clean state.
 *
 * Truncates all tables so every E2E test starts from the same baseline.
 * Tests create their own data via the createTest* helpers.
 */
export const resetDatabase = async () => {
  // TRUNCATE with RESTART IDENTITY CASCADE handles FK constraints
  // regardless of table order and resets any sequences.
  // Keep this table list in sync with Prisma models used by E2E scenarios.
  await prisma.$executeRaw`TRUNCATE TABLE "Interaction", "Wage", "Payment", "Order", "User", "Company", "ServiceWallet", "UsedInvite" RESTART IDENTITY CASCADE`
}

const random40 = () => {
  return Array.from({ length: 40 }, () => '0123456789'[Math.floor(Math.random() * 10)]).join('')
}

const randow8Numbers = () => {
  return crypto.randomInt(10000000, 99999999).toString()
}
/**
 * Creates a test company and returns it.
 */
export const createTestCompany = async (name, overrides = {}) => {
  return prisma.company.create({ data: { name, wallet: `0x${random40()}`, ...overrides } })
}

/**
 * Creates a test user and returns it.
 * Extra fields can be passed via overrides (e.g. wallet, level, parentId, nick).
 * If score/groupScore are non-zero, a zero-amount wage is created for the user.
 */
export const createTestUser = async (data = {}, score = 0, groupScore = 0) => {
  const slug = `${data.firstName.toLowerCase()}_${data.lastName.toLowerCase()}`
  const user = await prisma.user.create({
    data: {
      email: `${slug}@example.com`,
      password: testPasswordHash,
      nick: `@${slug}`,
      phone: `+3753${randow8Numbers()}`,
      memberId: `DOM-${randow8Numbers()}-0000`,
      wallet: `0x${random40()}`,
      companyId: 1,
      level: crypto.randomInt(1, 11),
      ...data,
    },
  })

  if (score !== 0 || groupScore !== 0) {
    await prisma.wage.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        score,
        groupScore,
        amount: 0,
      },
    })
  }

  return user
}

/**
 * Creates a test interaction and returns it.
 */
export const createTestInteraction = async (data) => {
  return prisma.interaction.create({ data })
}

/**
 * Creates a test payment with order and returns it.
 */
export const createTestOrder = async (company, user, amount, paymentStatus, uid = null) => {
  return await prisma.order.create({
    data: {
      userId: user.id,
      quantity: 1,
      totalAmount: amount,
      status: 'Paid',
      payment: {
        create: {
          userId: user.id,
          companyId: company.id,
          amount: amount,
          tokenSymbol: 'USDT',
          tokenContract: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd',
          tokenDecimals: 18,
          chainId: 97,
          txHash: `0x${random40()}`,
          fromWallet: user.wallet,
          toWallet: company.wallet,
          status: paymentStatus,
          uid: uid,
        },
      },
    },
    include: { payment: true },
  })
}

/**
 * Returns the Prisma client instance used by the reset helper.
 */
export const getPrisma = () => prisma

/**
 * Disconnects the Prisma client used by the reset helper.
 */
export const disconnectDatabase = async () => {
  await prisma.$disconnect()
}
