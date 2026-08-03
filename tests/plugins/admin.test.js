import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createApp } from '../helpers'

const SESSION_SECRET = 'test-secret-key-for-testing-purposes'

beforeAll(() => {
  vi.stubEnv('SESSION_SECRET', SESSION_SECRET)
})

describe('admin plugin', () => {
  it('getCompany returns null when user has no company', async () => {
    const app = await createApp()

    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: null,
    }

    const company = await app.admin.getCompany(adminUser)

    expect(company).toBeNull()
  })

  it('getCompany returns null when user is null', async () => {
    const app = await createApp()

    const company = await app.admin.getCompany(null)

    expect(company).toBeNull()
  })

  it('getCompany returns company data', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const foundCompany = {
      id: 1,
      name: 'Our House MLM',
      primaryWallet: '0x1234567890abcdef1234567890abcdef12345678',
      secondaryWallet: null,
    }

    const app = await createApp()
    vi.spyOn(app.prisma.company, 'findUnique').mockResolvedValue(foundCompany)

    const company = await app.admin.getCompany(adminUser)

    expect(company).toEqual(foundCompany)
    expect(app.prisma.company.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
    })
  })
})
