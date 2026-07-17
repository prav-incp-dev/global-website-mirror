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

  const company = await prisma.company.upsert({
    where: { name: 'Our House MLM' },
    update: {},
    create: {
      name: 'Our House MLM',
    },
  })

  const user = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      password: passwordHash,
      role: 'Admin',
      companyId: company.id,
      nick: 'admin',
      fullName: 'Alice Admin',
      phone: '+10000000001',
      memberId: 'MBR-0001',
      primaryWallet: '0xABCDEF1234567890',
      secondaryWallet: '0x0987654321FEDCBA',
    },
    create: {
      email: 'admin@example.com',
      password: passwordHash,
      role: 'Admin',
      nick: 'admin',
      fullName: 'Alice Admin',
      phone: '+10000000001',
      memberId: 'MBR-0001',
      primaryWallet: '0xABCDEF1234567890',
      secondaryWallet: '0x0987654321FEDCBA',
      company: {
        connect: { id: company.id },
      },
    },
  })

  console.log(`Seeded company: ${company.name}`)
  console.log(`Seeded admin user: ${user.email}`)
} finally {
  await prisma.$disconnect()
}
