import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import { UserRole } from '../src/generated/prisma/enums'
import { OrderStatus } from '../src/generated/prisma/enums'
import { PaymentStatus } from '../src/generated/prisma/enums'

const connectionString = process.env.DATABASE_URL
const passwordHashRounds = 12

if (!connectionString) {
  throw new Error('DATABASE_URL is not set')
}

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

try {
  const passwordHash = await bcrypt.hash('password', passwordHashRounds)

  const companyData = {
    name: 'Our House MLM',
    wallet: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
  }

  const company = await prisma.company.upsert({
    where: { name: companyData.name },
    update: {
      wallet: companyData.wallet,
    },
    create: companyData,
  })
  const companyWallet = company.wallet || companyData.wallet

  await prisma.serviceWallet.upsert({
    where: { name: 'Накопительный' },
    update: {},
    create: {
      name: 'Накопительный',
      address: '0x1111111111111111111111111111111111111111',
      percent: 40,
      companyId: company.id,
    },
  })

  const adminData = {
    password: passwordHash,
    role: UserRole.Admin,
    nick: 'admin',
    firstName: 'Alice',
    lastName: 'Admin',
    phone: '+10000000001',
    memberId: 'DOM-00000000-0001',
    // wallet: '0xABCDEF1234567890',
  }

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: adminData,
    create: {
      email: 'admin@example.com',
      ...adminData,
      company: { connect: { id: company.id } },
    },
  })

  console.log(`Seeded company: ${company.name}`)
  console.log(`Seeded admin user: ${admin.email}`)

  const consultantData = {
    password: passwordHash,
    role: UserRole.Consultant,
    nick: '@consultant',
    firstName: 'Test',
    lastName: 'Consultant',
    phone: '+10000000003',
    memberId: 'DOM-00000000-0003',
    level: 1,
    wallet: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
  }

  const consultant = await prisma.user.upsert({
    where: { email: 'consultant@example.com' },
    update: consultantData,
    create: {
      email: 'consultant@example.com',
      ...consultantData,
      companyId: company.id,
    },
  })

  const candidateData = {
    password: passwordHash,
    role: UserRole.Candidate,
    nick: '@candidate',
    firstName: 'Test',
    lastName: 'Candidate',
    phone: '+10000000002',
    memberId: 'DOM-00000000-0002',
    wallet: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
  }

  const candidate = await prisma.user.upsert({
    where: { email: 'candidate@example.com' },
    update: candidateData,
    create: {
      email: 'candidate@example.com',
      ...candidateData,
      companyId: company.id,
      parentId: consultant.id,
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
        status: OrderStatus.Paid,
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
            toWallet: companyWallet,
            status: PaymentStatus.Completed,
          },
        },
      },
    })

    seededPaymentHash = sampleTxHash
  }

  await prisma.interaction.create({
    data: {
      status: 'Closed',
      plannedAt: new Date(),
      completedAt: new Date(),
      description: 'Registration',
      initiatorId: null,
      targetId: consultant.id,
    },
  })

  await prisma.interaction.create({
    data: {
      status: 'Closed',
      plannedAt: new Date(),
      completedAt: new Date(),
      description: 'Registration',
      initiatorId: consultant.id,
      targetId: candidate.id,
    },
  })

  console.log(`Seeded candidate user: ${candidate.email}`)
  console.log(`Seeded consultant user: ${consultant.email}`)
  console.log(`Seeded sample payment: ${seededPaymentHash}`)
} finally {
  await prisma.$disconnect()
}
