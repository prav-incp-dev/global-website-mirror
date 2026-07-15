import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../src/generated/prisma/client'
import bcrypt from 'bcryptjs'

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
 * Resets the test database to a known seeded state.
 *
 * Truncates all tables and re-inserts the seed data so every E2E
 * test starts from the same baseline.
 */
export async function resetDatabase() {
  // TRUNCATE with RESTART IDENTITY CASCADE handles FK constraints
  // regardless of table order and resets any sequences.
  // Keep this table list in sync with Prisma models used by E2E scenarios.
  await prisma.$executeRaw`TRUNCATE TABLE "User", "Company" RESTART IDENTITY CASCADE`

  const company = await prisma.company.create({
    data: { name: 'Our House MLM' },
  })

  await prisma.user.create({
    data: {
      email: 'admin@example.com',
      password: testPasswordHash,
      role: 'Admin',
      nick: 'admin',
      fullName: 'Alice Admin',
      memberId: 'MBR-0001',
      primaryWallet: '0xABCDEF1234567890',
      secondaryWallet: '0x0987654321FEDCBA',
      companyId: company.id,
    },
  })
}

/**
 * Disconnects the Prisma client used by the reset helper.
 */
export async function disconnectDatabase() {
  await prisma.$disconnect()
}
