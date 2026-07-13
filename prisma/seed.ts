import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

const connectionString = process.env.DATABASE_URL
const passwordHashRounds = 12

if (!connectionString) {
  throw new Error('DATABASE_URL is not set')
}

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

try {
  const passwordHash = await bcrypt.hash('password', passwordHashRounds)

  const user = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      password: passwordHash,
      role: 'Admin',
    },
    create: {
      email: 'admin@example.com',
      password: passwordHash,
      role: 'Admin',
    },
  })

  console.log(`Seeded admin user: ${user.email}`)
} finally {
  await prisma.$disconnect()
}
