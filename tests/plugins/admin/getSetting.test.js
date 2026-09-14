import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../helpers'

const SESSION_SECRET = 'test-secret-key-for-testing-purposes'

beforeAll(() => {
  vi.stubEnv('SESSION_SECRET', SESSION_SECRET)
})

describe('getSetting', () => {
  it('returns null when user has no company', async () => {
    const app = await createApp()

    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: null,
    }

    const setting = await app.admin.getSetting(adminUser)

    expect(setting).toBeNull()
  })

  it('returns null when user is null', async () => {
    const app = await createApp()

    const setting = await app.admin.getSetting(null)

    expect(setting).toBeNull()
  })

  it('returns setting data', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const foundSetting = {
      id: 1,
      companyId: 1,
      general: { staleDays: 30, orphantDays: 40, refundFee: 5 },
      levels: {
        1: { percent: 20, personal: 3, general: 4, confirm: 0 },
      },
      prices: {
        0: 100,
        1: 1200,
      },
    }

    const app = await createApp()
    vi.spyOn(app.prisma.setting, 'findUnique').mockResolvedValue(foundSetting)

    const setting = await app.admin.getSetting(adminUser)

    expect(setting).toEqual(foundSetting)
    expect(app.prisma.setting.findUnique).toHaveBeenCalledWith({
      where: { companyId: 1 },
    })
  })
})
