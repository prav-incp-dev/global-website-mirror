import { UserRole } from '../../../src/generated/prisma/client'

export const adminUser = {
  id: 1,
  role: UserRole.Admin,
}

export const candidateUser = {
  id: 2,
  role: UserRole.Candidate,
  company: {
    id: 1,
    wallet: '0x1111111111111111111111111111111111111111',
  },
}

export const TX_HASH = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

export const OTHER_TX_HASH = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

export const FROM_WALLET = '0x2222222222222222222222222222222222222222'

export const RECIPIENT_WALLET = '0x1111111111111111111111111111111111111111'

export const TOKEN_CONTRACT = '0x3333333333333333333333333333333333333333'
