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
    update: {
      primaryWallet: '0x1111111111111111111111111111111111111111',
    },
    create: {
      name: 'Our House MLM',
      primaryWallet: '0x1111111111111111111111111111111111111111',
    },
  })
  const companyPrimaryWallet = company.primaryWallet || '0x1111111111111111111111111111111111111111'

  const user = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      password: passwordHash,
      role: 'Admin',
      companyId: company.id,
      nick: 'admin',
      firstName: 'Alice',
      lastName: 'Admin',
      phone: '+10000000001',
      memberId: 'DOM-00000000-OOO1',
      wallet: '0xABCDEF1234567890',
    },
    create: {
      email: 'admin@example.com',
      password: passwordHash,
      role: 'Admin',
      nick: 'admin',
      firstName: 'Alice',
      lastName: 'Admin',
      phone: '+10000000001',
      memberId: 'DOM-00000000-0001',
      wallet: '0xABCDEF1234567890',
      company: {
        connect: { id: company.id },
      },
    },
  })

  console.log(`Seeded company: ${company.name}`)
  console.log(`Seeded admin user: ${user.email}`)

  const candidate = await prisma.user.upsert({
    where: { email: 'candidate@example.com' },
    update: {
      password: passwordHash,
      role: 'Candidate',
      companyId: company.id,
      nick: '@candidate',
      firstName: 'Test',
      lastName: 'Candidate',
      phone: '+10000000002',
      memberId: 'DOM-00000000-0002',
      wallet: '0x2222222222222222222222222222222222222222',
    },
    create: {
      email: 'candidate@example.com',
      password: passwordHash,
      role: 'Candidate',
      companyId: company.id,
      nick: '@candidate',
      firstName: 'Test',
      lastName: 'Candidate',
      phone: '+10000000002',
      memberId: 'DOM-00000000-0002',
      wallet: '0x2222222222222222222222222222222222222222',
    },
  })

  const existingPayment = await prisma.payment.findUnique({
    where: { txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
  })

  let seededPaymentHash = existingPayment?.txHash
  if (!existingPayment) {
    const sampleTxHash = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

    await prisma.order.create({
      data: {
        userId: candidate.id,
        quantity: 1,
        totalAmount: 1200,
        status: 'Paid',
        payment: {
          create: {
            userId: candidate.id,
            companyId: company.id,
            amount: 1200,
            tokenSymbol: 'USDT',
            tokenContract: '0x3333333333333333333333333333333333333333',
            tokenDecimals: 18,
            chainId: 97,
            txHash: sampleTxHash,
            fromWallet: '0x2222222222222222222222222222222222222222',
            toWallet: companyPrimaryWallet,
            status: 'Completed',
          },
        },
      },
    })

    seededPaymentHash = sampleTxHash
  }

  console.log(`Seeded candidate user: ${candidate.email}`)
  console.log(`Seeded sample payment: ${seededPaymentHash}`)
} finally {
  await prisma.$disconnect()
}
