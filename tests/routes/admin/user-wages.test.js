import { describe, expect, it, vi } from 'vitest'
import { createNoCsrfApp as createApp } from '../../helpers'

const createCompany = async (app, name) => {
  return app.prisma.company.create({
    data: { name },
  })
}

describe('PUT /api/admin/user/:id/wages', () => {
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
        email: `${emailPrefix || 'wages-user'}-${Date.now()}@test.com`,
        password: 'hashed',
        role: 'Consultant',
        firstName: 'Wages',
        lastName: 'User',
        phone: `+375294${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`,
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
      method: 'PUT',
      url: '/api/admin/user/1/wages',
      payload: { score: 10, groupScore: 20 },
    })
    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({
      error: '\u0414\u043e\u0441\u0442\u0443\u043f \u0437\u0430\u043f\u0440\u0435\u0449\u0435\u043d',
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
      method: 'PUT',
      url: '/api/admin/user/1/wages',
      payload: { score: 10, groupScore: 20 },
    })
    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({
      error: '\u0414\u043e\u0441\u0442\u0443\u043f \u0437\u0430\u043f\u0440\u0435\u0449\u0435\u043d',
    })
  })

  it('returns 400 when id param is missing', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())
    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user//wages',
      payload: { score: 10, groupScore: 20 },
    })
    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when score is missing', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())
    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/1/wages',
      payload: { groupScore: 20 },
    })
    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('score')
  })

  it('returns 400 when groupScore is missing', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())
    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/1/wages',
      payload: { score: 10 },
    })
    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('groupScore')
  })

  it('returns 400 when score is negative', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())
    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/1/wages',
      payload: { score: -1, groupScore: 20 },
    })
    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when groupScore is negative', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(createAdminUser())
    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/1/wages',
      payload: { score: 10, groupScore: -1 },
    })
    expect(response.statusCode).toBe(400)
  })
  it('returns 404 when target user does not exist', async ({ expect }) => {
    const app = await createApp()
    const company = await createCompany(app, 'Wages Not Found Company')
    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/999999/wages',
      payload: { score: 10, groupScore: 20 },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Пользователь не найден' })
  })

  it('returns 403 when target user is in a different company', async ({ expect }) => {
    const app = await createApp()
    const companyA = await createCompany(app, 'Wages Company A')
    const companyB = await createCompany(app, 'Wages Company B')

    const targetUser = await createUser(app, { companyId: companyB.id })

    const adminUser = createAdminUser()
    adminUser.company.id = companyA.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: `/api/admin/user/${targetUser.id}/wages`,
      payload: { score: 10, groupScore: 20 },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('returns 400 when target user is not a Consultant', async ({ expect }) => {
    const app = await createApp()
    const company = await createCompany(app, 'Wages Non Consultant Company')

    const targetUser = await createUser(app, {
      companyId: company.id,
      emailPrefix: 'wages-candidate',
      role: 'Candidate',
    })

    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: `/api/admin/user/${targetUser.id}/wages`,
      payload: { score: 10, groupScore: 20 },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ error: 'Устанавливать единицы можно только консультантам' })
  })

  it('returns 200 and delegates to setScores when it succeeds', async ({ expect }) => {
    const app = await createApp()
    const company = await createCompany(app, 'Wages Delegation Company')
    const targetUser = await createUser(app, { companyId: company.id })
    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    const setScoresSpy = vi.spyOn(app.admin, 'setScores').mockResolvedValue({ success: true })
    const response = await app.inject({
      method: 'PUT',
      url: `/api/admin/user/${targetUser.id}/wages`,
      payload: { score: 10, groupScore: 20 },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ success: true, score: 10, groupScore: 20 })
    expect(setScoresSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: targetUser.id, companyId: company.id, role: 'Consultant' }),
      { score: 10, groupScore: 20 },
    )
  })

  it('returns 400 with the setScores error message when setScores returns an error', async ({ expect }) => {
    const app = await createApp()
    const company = await createCompany(app, 'Wages Delegation Error Company')
    const targetUser = await createUser(app, { companyId: company.id })
    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.admin, 'setScores').mockResolvedValue({ error: 'Some setScores error' })
    const response = await app.inject({
      method: 'PUT',
      url: `/api/admin/user/${targetUser.id}/wages`,
      payload: { score: 10, groupScore: 20 },
    })
    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ error: 'Some setScores error' })
  })

  it('returns 500 when setScores throws', async ({ expect }) => {
    const app = await createApp()
    const company = await createCompany(app, 'Wages Delegation Throw Company')
    const targetUser = await createUser(app, { companyId: company.id })
    const adminUser = createAdminUser()
    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.admin, 'setScores').mockRejectedValue(new Error('Database connection failed'))
    const response = await app.inject({
      method: 'PUT',
      url: `/api/admin/user/${targetUser.id}/wages`,
      payload: { score: 10, groupScore: 20 },
    })
    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({
      error:
        '\u041e\u0448\u0438\u0431\u043a\u0430 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f',
    })
  })

  it('returns 500 on unexpected database error', async ({ expect }) => {
    const app = await createApp()
    const adminUser = createAdminUser()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.prisma.user, 'findUnique').mockRejectedValue(new Error('Database connection failed'))
    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/1/wages',
      payload: { score: 10, groupScore: 20 },
    })
    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({
      error:
        '\u041e\u0448\u0438\u0431\u043a\u0430 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f',
    })
  })
})
