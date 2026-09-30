import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import { UserRole } from '../src/generated/prisma/enums'
import { OrderStatus } from '../src/generated/prisma/enums'
import { PaymentStatus } from '../src/generated/prisma/enums'
import { HOURS24 } from '../src/lib/constants.js'


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

  await prisma.setting.upsert({
    where: { companyId: company.id },
    update: {},
    create: {
      companyId: company.id,
      general: { staleDays: 30, orphantDays: 40, refundMinutes: HOURS24, refundFee: 5 },
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
    },
  })

  const adminData = {
    password: passwordHash,
    role: UserRole.Admin,
    nick: 'admin',
    firstName: 'Alice',
    lastName: 'Admin',
    phone: '+70000000001',
    memberId: 'DOM-00000000-0001',
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

  const secondAdminData = {
    password: passwordHash,
    role: UserRole.Admin,
    nick: 'incp',
    firstName: 'INCP',
    lastName: 'Admin',
    phone: '+70000000004',
    memberId: 'DOM-00000000-0004',
  }

  const secondAdmin = await prisma.user.upsert({
    where: { email: 'incpinfo@proton.me' },
    update: secondAdminData,
    create: {
      email: 'incpinfo@proton.me',
      ...secondAdminData,
      company: { connect: { id: company.id } },
    },
  })

  console.log(`Seeded company: ${company.name}`)
  console.log(`Seeded admin user: ${admin.email}`)
  console.log(`Seeded admin user: ${secondAdmin.email}`)

  const consultantData = {
    password: passwordHash,
    role: UserRole.Consultant,
    nick: '@consultant',
    firstName: 'Test',
    lastName: 'Consultant',
    phone: '+70000000003',
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
    phone: '+70000000002',
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
            finalized: true,
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
