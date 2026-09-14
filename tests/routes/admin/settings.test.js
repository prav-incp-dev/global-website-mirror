import { describe, expect, it, vi } from 'vitest'
import { createNoCsrfApp as createApp } from '../../helpers'

const createAdminUser = () => ({
  id: 1,
  email: 'admin@test.com',
  role: 'Admin',
  company: { id: 1 },
})

const ADMIN_SETTING_FIXTURE = {
  id: 1,
  companyId: 1,
  general: { staleDays: 30, orphantDays: 40, refundFee: 5 },
  levels: {},
  prices: {},
}

describe('PUT /api/admin/settings', () => {
  it('returns 403 when user is not authenticated', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(null)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      payload: { type: 'general', data: { staleDays: 30 } },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
    expect(app.auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('returns 403 when user is not Admin', async () => {
    const nonAdminUser = {
      id: 1,
      email: 'user@example.com',
      role: 'Candidate',
      company: { id: 1 },
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(nonAdminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      payload: { type: 'general', data: { staleDays: 30 } },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
    expect(app.auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('returns 400 when type is missing', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      payload: { data: {} },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('type')
  })

  it('returns 400 when data is missing', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      payload: { type: 'general' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('data')
  })

  it('returns 400 when type is invalid', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      payload: { type: 'invalid', data: {} },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('type')
  })

  it('returns 200 and creates a setting when none exists', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())
    const upsertSpy = vi.spyOn(app.prisma.setting, 'upsert').mockResolvedValue(ADMIN_SETTING_FIXTURE)

    const generalData = { staleDays: 30, orphantDays: 40, refundFee: 5 }

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      payload: { type: 'general', data: generalData },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ success: true, setting: ADMIN_SETTING_FIXTURE })
    expect(upsertSpy).toHaveBeenCalledWith({
      where: { companyId: 1 },
      update: { general: generalData },
      create: {
        companyId: 1,
        general: generalData,
        levels: {},
        prices: {},
      },
    })
  })

  it('returns 200 and updates levels (update path)', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())
    const upsertSpy = vi.spyOn(app.prisma.setting, 'upsert').mockResolvedValue(ADMIN_SETTING_FIXTURE)

    const levelsData = {
      1: { percent: 20, personal: 3, general: 4, confirm: 0 },
      2: { percent: 30, personal: 10, general: 10, confirm: 2 },
    }

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      payload: { type: 'levels', data: levelsData },
    })

    expect(response.statusCode).toBe(200)
    expect(upsertSpy).toHaveBeenCalledWith({
      where: { companyId: 1 },
      update: { levels: levelsData },
      create: {
        companyId: 1,
        general: {},
        levels: levelsData,
        prices: {},
      },
    })
  })

  it('returns 200 and updates prices (update path)', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())
    const upsertSpy = vi.spyOn(app.prisma.setting, 'upsert').mockResolvedValue(ADMIN_SETTING_FIXTURE)

    const pricesData = { 0: 100, 1: 1200, 2: 2400 }

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      payload: { type: 'prices', data: pricesData },
    })

    expect(response.statusCode).toBe(200)
    expect(upsertSpy).toHaveBeenCalledWith({
      where: { companyId: 1 },
      update: { prices: pricesData },
      create: {
        companyId: 1,
        general: {},
        levels: {},
        prices: pricesData,
      },
    })
  })

  it('returns 500 on unexpected error', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())
    vi.spyOn(app.prisma.setting, 'upsert').mockRejectedValue(new Error('Database connection failed'))

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      payload: { type: 'general', data: { staleDays: 30 } },
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ error: 'Ошибка сохранения настроек' })
  })
})
