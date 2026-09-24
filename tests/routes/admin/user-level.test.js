import { describe, expect, it, vi } from 'vitest'
import { createNoCsrfApp as createApp } from '../../helpers'

const createCompany = async (app, name) => {
  return app.prisma.company.create({
    data: { name },
  })
}

describe('PUT /api/admin/user/:id/level', () => {
  const createAdminUser = () => ({
    id: 1,
    email: 'admin@test.com',
    role: 'Admin',
    company: { id: 1 },
  })

  const createUser = async (app, overrides = {}) => {
    const { emailPrefix, ...data } = overrides
    return app.prisma.user.create({
      data: {
        email: `${emailPrefix || 'user'}-${Date.now()}@test.com`,
        password: 'hashed',
        role: 'Consultant',
        firstName: 'Target',
        lastName: 'User',
        phone: `+375291${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`,
        level: 1,
        levelConfirmed: true,
        ...data,
      },
    })
  }

  const validPayload = (userId, overrides = {}) => ({
    level: 2,
    levelConfirmed: true,
    ...overrides,
  })

  it('returns 403 when user is not authenticated', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(null)
    const response = await app.inject({ method: 'PUT', url: '/api/admin/user/1/level', payload: validPayload() })
    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({
      error: 'Доступ запрещен',
    })
  })

  it('returns 403 when user is not Admin', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue({
      id: 1,
      email: 'candidate@test.com',
      role: 'Candidate',
      company: { id: 1 },
    })
    const response = await app.inject({ method: 'PUT', url: '/api/admin/user/1/level', payload: validPayload() })
    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({
      error: 'Доступ запрещен',
    })
  })

  it('returns 400 when id param is missing', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())
    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user//level',
      payload: { level: 2, levelConfirmed: true },
    })
    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when level is missing', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())
    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/1/level',
      payload: { levelConfirmed: true },
    })
    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('required')
  })

  it('returns 400 when levelConfirmed is missing', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())
    const response = await app.inject({ method: 'PUT', url: '/api/admin/user/1/level', payload: { level: 2 } })
    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('required')
  })

  it('returns 400 when level is below minimum', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())
    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/1/level',
      payload: { level: -1, levelConfirmed: true },
    })
    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when level is above maximum', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())
    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/1/level',
      payload: { level: 11, levelConfirmed: true },
    })
    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when levelConfirmed is not a boolean', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())
    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/1/level',
      payload: { level: 2, levelConfirmed: 'yes' },
    })
    expect(response.statusCode).toBe(400)
  })

  it('returns 404 when target user does not exist', async () => {
    const app = await createApp()
    const company = await createCompany(app, 'Level Not Found Company')
    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/999999/level',
      payload: { level: 2, levelConfirmed: true },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Пользователь не найден' })
  })

  it('returns 403 when target user is in a different company', async () => {
    const app = await createApp()
    const companyA = await createCompany(app, 'Level Company A')
    const companyB = await createCompany(app, 'Level Company B')

    const targetUser = await createUser(app, { companyId: companyB.id })

    const adminUser = createAdminUser()
    adminUser.company.id = companyA.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: `/api/admin/user/${targetUser.id}/level`,
      payload: { level: 2, levelConfirmed: true },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('returns 400 when target user is not a Consultant', async () => {
    const app = await createApp()
    const company = await createCompany(app, 'Level Non Consultant Company')

    const targetUser = await createUser(app, {
      companyId: company.id,
      emailPrefix: 'candidate',
      role: 'Candidate',
    })

    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: `/api/admin/user/${targetUser.id}/level`,
      payload: { level: 2, levelConfirmed: true },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ error: 'Обновлять уровень можно только консультантам' })
  })

  it('returns 400 when the user already has a wage with non-zero amount', async () => {
    const app = await createApp()
    const company = await createCompany(app, 'Level NonZero Wage Company')

    const targetUser = await createUser(app, { companyId: company.id })

    // Simulate real sales: create a wage with non-zero amount and lock the user
    await app.prisma.wage.create({
      data: {
        companyId: company.id,
        userId: targetUser.id,
        amount: 500,
        score: 10,
        groupScore: 20,
        description: 'Sale payment',
      },
    })
    await app.prisma.user.update({
      where: { id: targetUser.id },
      data: { isLocked: true },
    })

    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: `/api/admin/user/${targetUser.id}/level`,
      payload: { level: 3, levelConfirmed: true },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ error: 'У пользователя уже есть продажи' })
  })

  it('successfully updates level and levelConfirmed and creates LevelHistory', async () => {
    const app = await createApp()
    const company = await createCompany(app, 'Level Update Company')

    const targetUser = await createUser(app, { companyId: company.id })

    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: `/api/admin/user/${targetUser.id}/level`,
      payload: { level: 3, levelConfirmed: false },
    })

    expect(response.statusCode).toBe(200)

    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.user).toEqual({
      id: targetUser.id,
      level: 3,
      levelConfirmed: false,
    })

    const updatedUser = await app.prisma.user.findUnique({ where: { id: targetUser.id } })
    expect(updatedUser.level).toBe(3)
    expect(updatedUser.levelConfirmed).toBe(false)

    // Verify LevelHistory was created
    const levelHistory = await app.prisma.levelHistory.findFirst({
      where: { userId: targetUser.id },
      orderBy: { createdAt: 'desc' },
    })
    expect(levelHistory).toBeDefined()
    expect(levelHistory.oldLevel).toBe(1)
    expect(levelHistory.newLevel).toBe(3)
  })

  it('reuses the existing LevelHistory row instead of creating a new one on subsequent level changes', async () => {
    const app = await createApp()
    const company = await createCompany(app, 'Level Update Reuse Company')

    const targetUser = await createUser(app, { companyId: company.id })

    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const setLevel = async (level) => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/admin/user/${targetUser.id}/level`,
        payload: { level, levelConfirmed: true },
      })
      expect(response.statusCode).toBe(200)
    }

    // First change creates a single history row
    await setLevel(3)
    const firstHistory = await app.prisma.levelHistory.findMany({ where: { userId: targetUser.id } })
    expect(firstHistory).toHaveLength(1)
    expect(firstHistory[0].oldLevel).toBe(1)
    expect(firstHistory[0].newLevel).toBe(3)

    // Second change to a different level reuses the same row (no new record)
    await setLevel(2)
    const allHistory = await app.prisma.levelHistory.findMany({
      where: { userId: targetUser.id },
      orderBy: { createdAt: 'asc' },
    })
    expect(allHistory).toHaveLength(1)
    expect(allHistory[0].id).toBe(firstHistory[0].id)
    expect(allHistory[0].oldLevel).toBe(3)
    expect(allHistory[0].newLevel).toBe(2)

    // createdAt is refreshed on update
    expect(allHistory[0].createdAt.getTime()).toBeGreaterThan(firstHistory[0].createdAt.getTime())
  })

  it('returns 500 on unexpected database error', async () => {
    const app = await createApp()
    const adminUser = createAdminUser()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.prisma.user, 'findUnique').mockRejectedValue(new Error('Database connection failed'))

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/1/level',
      payload: { level: 2, levelConfirmed: true },
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ error: 'Ошибка обновления пользователя' })
  })
})
