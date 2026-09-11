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
  await prisma.$executeRaw`TRUNCATE TABLE "Interaction", "Wage", "Payment", "Order", "User", "Setting", "Company", "UsedInvite", "LevelHistory" RESTART IDENTITY CASCADE`
}

const random40 = () => {
  return Array.from({ length: 40 }, () => '0123456789'[Math.floor(Math.random() * 10)]).join('')
}

const randow8Numbers = () => {
  return crypto.randomInt(10000000, 99999999).toString()
}
/**
 * Creates a test company with default seeded settings and returns it.
 * Company-level overrides (e.g. wallet, name) go to the Company row;
 * pass a `settings` key to override the default Setting row.
 */
export const createTestCompany = async (name, overrides = {}) => {
  const { settings = {}, ...companyData } = overrides
  const company = await prisma.company.create({
    data: { name, wallet: `0x${random40()}`, ...companyData },
  })

  await prisma.setting.create({
    data: {
      companyId: company.id,
      general: { staleDays: 30, orphantDays: 40, refundFee: 5 },
      levels: {
        1: { percent: 20.0, personal: 3, general: 3, confirm: 0 },
        2: { percent: 30.0, personal: 3, general: 10, confirm: 2 },
        3: { percent: 39.0, personal: 4, general: 20, confirm: 3 },
        4: { percent: 46.0, personal: 5, general: 50, confirm: 4 },
        5: { percent: 52.0, personal: 6, general: 120, confirm: 5 },
        6: { percent: 56.0, personal: 0, general: 300, confirm: 6 },
        7: { percent: 58.0, personal: 0, general: 750, confirm: 7 },
        8: { percent: 59.0, personal: 0, general: 2000, confirm: 8 },
        9: { percent: 59.5, personal: 0, general: 4500, confirm: 9 },
        10: { percent: 60, personal: 0, general: 0, confirm: 0 },
      },
      prices: {
        0: 100,
        1: 1200,
        2: 2400,
        3: 3600,
        4: 4800,
        5: 6000,
      },
      ...settings,
    },
  })

  return company
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
