import { describe, expect, it, vi } from 'vitest'
import { createNoCsrfApp as createApp } from '../../helpers'
import { CLIENT_WAGES_LIMIT } from '../../../src/lib/constants'

const createCompany = async (app, name) => {
  return app.prisma.company.create({
    data: { name },
  })
}

describe('GET /api/admin/user/:id/wages', () => {
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
        email: `${emailPrefix || 'user-wages'}-${Date.now()}@test.com`,
        password: 'hashed',
        role: 'Consultant',
        firstName: 'User',
        lastName: 'Wages',
        phone: `+375296${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`,
        level: 1,
        levelConfirmed: true,
        ...data,
      },
    })
  }

  const createWage = async (app, companyId, userId, amount, description, createdAt) => {
    return app.prisma.wage.create({
      data: {
        companyId,
        userId,
        amount,
        description,
        score: 0,
        groupScore: 0,
        createdAt,
      },
    })
  }

  it('returns 403 when user is not authenticated', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(null)
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/user/1/wages',
    })
    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('returns 403 when user is not Admin', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue({
      id: 1,
      email: 'candidate@test.com',
      role: 'Candidate',
      company: { id: 1 },
    })
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/user/1/wages',
    })
    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('returns 400 when id param is missing', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/user//wages',
    })
    expect(response.statusCode).toBe(400)
  })

  it('returns 404 when target user does not exist', async () => {
    const app = await createApp()
    const company = await createCompany(app, 'User Wages Not Found Company')
    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/user/999999/wages',
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Пользователь не найден' })
  })

  it('returns 403 when target user is in a different company', async () => {
    const app = await createApp()
    const companyA = await createCompany(app, 'User Wages Company A')
    const companyB = await createCompany(app, 'User Wages Company B')

    const targetUser = await createUser(app, { companyId: companyB.id })

    const adminUser = createAdminUser()
    adminUser.company.id = companyA.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'GET',
      url: `/api/admin/user/${targetUser.id}/wages`,
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('returns 200 with wages converted to numbers, newest first', async () => {
    const app = await createApp()
    const company = await createCompany(app, 'User Wages Success Company')
    const targetUser = await createUser(app, { companyId: company.id })
    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const older = await createWage(
      app,
      company.id,
      targetUser.id,
      100.5,
      'Older wage',
      new Date('2024-01-01T00:00:00.000Z'),
    )
    const newer = await createWage(
      app,
      company.id,
      targetUser.id,
      200.25,
      'Newer wage',
      new Date('2024-02-01T00:00:00.000Z'),
    )

    const response = await app.inject({
      method: 'GET',
      url: `/api/admin/user/${targetUser.id}/wages`,
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.wages).toHaveLength(2)
    expect(body.wages[0].id).toBe(newer.id)
    expect(body.wages[0].amount).toBe(200.25)
    expect(body.wages[0].description).toBe('Newer wage')
    expect(body.wages[0].createdAt).toBe(newer.createdAt.toISOString())
    expect(body.wages[1].id).toBe(older.id)
    expect(body.wages[1].amount).toBe(100.5)
  })

  it('caps results at CLIENT_WAGES_LIMIT', async () => {
    const app = await createApp()
    const company = await createCompany(app, 'User Wages Limit Company')
    const targetUser = await createUser(app, { companyId: company.id })
    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    // Create more wages than CLIENT_WAGES_LIMIT, with increasing createdAt
    const total = CLIENT_WAGES_LIMIT + 3
    const created = []
    for (let i = 0; i < total; i++) {
      created.push(
        await createWage(app, company.id, targetUser.id, i + 1, `Wage ${i + 1}`, new Date(Date.UTC(2024, 0, i + 1))),
      )
    }

    // The route always returns at most CLIENT_WAGES_LIMIT wages, newest first
    const response = await app.inject({
      method: 'GET',
      url: `/api/admin/user/${targetUser.id}/wages`,
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.wages).toHaveLength(CLIENT_WAGES_LIMIT)
    // Newest first: the last created wage should be first, and the oldest should be excluded
    const expectedNewest = created
      .slice(-CLIENT_WAGES_LIMIT)
      .reverse()
      .map((w) => w.id)
    expect(body.wages.map((w) => w.id)).toEqual(expectedNewest)
  })

  it('returns 200 with an empty wages array when the user has no wages', async () => {
    const app = await createApp()
    const company = await createCompany(app, 'User Wages Empty Company')
    const targetUser = await createUser(app, { companyId: company.id })
    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'GET',
      url: `/api/admin/user/${targetUser.id}/wages`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ wages: [] })
  })

  it('returns 500 when prisma user lookup throws', async () => {
    const app = await createApp()
    const company = await createCompany(app, 'User Wages User Error Company')
    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.prisma.user, 'findUnique').mockRejectedValue(new Error('Database connection failed'))

    const response = await app.inject({
      method: 'GET',
      url: `/api/admin/user/${adminUser.id}/wages`,
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ error: 'Ошибка получения начислений' })
  })

  it('returns 500 when prisma wage lookup throws', async () => {
    const app = await createApp()
    const company = await createCompany(app, 'User Wages Wage Error Company')
    const targetUser = await createUser(app, { companyId: company.id })
    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.prisma.wage, 'findMany').mockRejectedValue(new Error('Database connection failed'))

    const response = await app.inject({
      method: 'GET',
      url: `/api/admin/user/${targetUser.id}/wages`,
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ error: 'Ошибка получения начислений' })
  })
})
