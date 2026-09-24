import { describe, expect, it, vi } from 'vitest'
import { createNoCsrfApp as createApp } from '../../helpers'

const createCompany = async (app, name) => {
  return app.prisma.company.create({
    data: { name },
  })
}

describe('POST /api/admin/user/:id/wages', () => {
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
        email: `${emailPrefix || 'wage-user'}-${Date.now()}@test.com`,
        password: 'hashed',
        role: 'Consultant',
        firstName: 'Wage',
        lastName: 'Create',
        phone: `+375295${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`,
        level: 1,
        levelConfirmed: true,
        ...data,
      },
    })
  }

  it('returns 403 when user is not authenticated', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(null)
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/user/1/wages',
      payload: { amount: 100, description: 'Test wage' },
    })
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
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/user/1/wages',
      payload: { amount: 100, description: 'Test wage' },
    })
    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({
      error: 'Доступ запрещен',
    })
  })

  it('returns 400 when id param is missing', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/user//wages',
      payload: { amount: 100, description: 'Test wage' },
    })
    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when amount is missing', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/user/1/wages',
      payload: { description: 'Test wage' },
    })
    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('amount')
  })

  it('returns 400 when description is missing', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/user/1/wages',
      payload: { amount: 100 },
    })
    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('description')
  })

  it('returns 400 when amount is negative', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/user/1/wages',
      payload: { amount: -10, description: 'Test wage' },
    })
    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when description is empty string', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/user/1/wages',
      payload: { amount: 100, description: '' },
    })
    expect(response.statusCode).toBe(400)
  })

  it('returns 404 when target user does not exist', async () => {
    const app = await createApp()
    const company = await createCompany(app, 'Wage Create Not Found Company')
    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/user/999999/wages',
      payload: { amount: 100, description: 'Test wage' },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Пользователь не найден' })
  })

  it('returns 403 when target user is in a different company', async () => {
    const app = await createApp()
    const companyA = await createCompany(app, 'Wage Create Company A')
    const companyB = await createCompany(app, 'Wage Create Company B')

    const targetUser = await createUser(app, { companyId: companyB.id })

    const adminUser = createAdminUser()
    adminUser.company.id = companyA.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/user/${targetUser.id}/wages`,
      payload: { amount: 100, description: 'Test wage' },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('returns 400 when target user is not a Consultant', async () => {
    const app = await createApp()
    const company = await createCompany(app, 'Wage Create Non Consultant Company')

    const targetUser = await createUser(app, {
      companyId: company.id,
      emailPrefix: 'wage-candidate',
      role: 'Candidate',
    })

    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/user/${targetUser.id}/wages`,
      payload: { amount: 100, description: 'Test wage' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ error: 'Начислять можно только консультантам' })
  })

  it('successfully creates a wage with amount, description, score=0 and groupScore=0', async () => {
    const app = await createApp()
    const company = await createCompany(app, 'Wage Create Success Company')

    const targetUser = await createUser(app, { companyId: company.id })

    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/user/${targetUser.id}/wages`,
      payload: { amount: 250.5, description: 'Monthly bonus' },
    })

    expect(response.statusCode).toBe(200)

    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.wage).toBeDefined()
    expect(body.wage.userId).toBe(targetUser.id)
    expect(body.wage.companyId).toBe(company.id)
    expect(Number(body.wage.amount)).toBe(250.5)
    expect(body.wage.description).toBe('Monthly bonus')
    expect(body.wage.score).toBe(0)
    expect(body.wage.groupScore).toBe(0)

    // Verify the wage was actually persisted in the database
    const wage = await app.prisma.wage.findUnique({ where: { id: body.wage.id } })
    expect(wage).toBeDefined()
    expect(wage.userId).toBe(targetUser.id)
    expect(wage.companyId).toBe(company.id)
    expect(Number(wage.amount)).toBe(250.5)
    expect(wage.description).toBe('Monthly bonus')
    expect(wage.score).toBe(0)
    expect(wage.groupScore).toBe(0)

    // Verify the user was locked (isLocked set to true)
    const updatedUser = await app.prisma.user.findUnique({ where: { id: targetUser.id } })
    expect(updatedUser.isLocked).toBe(true)
  })

  it('successfully creates a wage with zero amount and still locks the user', async () => {
    const app = await createApp()
    const company = await createCompany(app, 'Wage Create Zero Amount Company')

    const targetUser = await createUser(app, { companyId: company.id })

    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/user/${targetUser.id}/wages`,
      payload: { amount: 0, description: 'Zero amount wage' },
    })

    expect(response.statusCode).toBe(200)

    const body = response.json()
    expect(body.success).toBe(true)
    expect(Number(body.wage.amount)).toBe(0)

    // Even with zero amount, the user should be locked
    const updatedUser = await app.prisma.user.findUnique({ where: { id: targetUser.id } })
    expect(updatedUser.isLocked).toBe(true)
  })

  it('returns 500 on unexpected database error', async () => {
    const app = await createApp()
    const adminUser = createAdminUser()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.prisma.user, 'findUnique').mockRejectedValue(new Error('Database connection failed'))

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/user/1/wages',
      payload: { amount: 100, description: 'Test wage' },
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ error: 'Ошибка создания начисления' })
  })
})
