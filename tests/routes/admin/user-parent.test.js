import { describe, expect, it, vi } from 'vitest'
import { createNoCsrfApp as createApp } from '../../helpers'

const createCompany = async (app, name) => {
  return app.prisma.company.create({
    data: { name },
  })
}

describe('PUT /api/admin/user/parent', () => {
  it('returns 403 when user is not authenticated', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(null)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/parent',
      payload: { userId: 1, parentId: 2 },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
    expect(app.auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('returns 403 when user is not Admin', async () => {
    const nonAdminUser = { id: 1, email: 'user@example.com', role: 'Candidate', company: { id: 1 } }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(nonAdminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/parent',
      payload: { userId: 2, parentId: 3 },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
    expect(app.auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('returns 400 when userId is missing', async () => {
    const adminUser = { id: 1, email: 'admin@example.com', role: 'Admin', company: { id: 1 } }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/parent',
      payload: { parentId: 2 },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('required')
  })

  it('returns 400 when parentId is a string', async () => {
    const adminUser = { id: 1, email: 'admin@example.com', role: 'Admin', company: { id: 1 } }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/parent',
      payload: { userId: 2, parentId: 'abc' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('parentId')
  })

  it('returns 404 when target user does not exist', async () => {
    const adminUser = { id: 1, email: 'admin@test.com', role: 'Admin', company: { id: 1 } }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/parent',
      payload: { userId: 99999, parentId: 2 },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Пользователь не найден' })
  })

  it('returns 400 when userId equals parentId', async () => {
    const adminUser = { id: 1, email: 'admin@test.com', role: 'Admin', company: { id: 1 } }

    const app = await createApp()
    const company = await createCompany(app, 'Self Parent Test Company')

    const user = await app.prisma.user.create({
      data: {
        email: `self-parent-${Date.now()}@test.com`,
        password: 'hashed',
        role: 'Candidate',
        firstName: 'Self',
        lastName: 'Parent',
        phone: '+375291000001',
        companyId: company.id,
      },
    })

    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/parent',
      payload: { userId: user.id, parentId: user.id },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ error: 'Пользователь не может быть собственным родителем' })
  })

  it('returns 403 when target user is in a different company', async () => {
    const adminUser = { id: 1, email: 'admin@test.com', role: 'Admin', company: { id: 1 } }

    const app = await createApp()
    const companyA = await createCompany(app, 'Company A for Cross Company')
    const companyB = await createCompany(app, 'Company B for Cross Company')

    const userInCompanyB = await app.prisma.user.create({
      data: {
        email: `cross-company-${Date.now()}@test.com`,
        password: 'hashed',
        role: 'Candidate',
        firstName: 'Cross',
        lastName: 'Company',
        phone: '+375291000002',
        companyId: companyB.id,
      },
    })

    adminUser.company.id = companyA.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/parent',
      payload: { userId: userInCompanyB.id, parentId: null },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('returns 404 when parent user does not exist', async () => {
    const adminUser = { id: 1, email: 'admin@test.com', role: 'Admin', company: { id: 1 } }

    const app = await createApp()
    const company = await createCompany(app, 'Parent Not Found Company')

    const user = await app.prisma.user.create({
      data: {
        email: `parent-not-found-${Date.now()}@test.com`,
        password: 'hashed',
        role: 'Candidate',
        firstName: 'Parent',
        lastName: 'NotFound',
        phone: '+375291000003',
        companyId: company.id,
      },
    })

    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/parent',
      payload: { userId: user.id, parentId: 99999 },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Родительский пользователь не найден' })
  })

  it('returns 403 when parent user is in a different company', async () => {
    const adminUser = { id: 1, email: 'admin@test.com', role: 'Admin', company: { id: 1 } }

    const app = await createApp()
    const companyA = await createCompany(app, 'Parent Cross Company A')
    const companyB = await createCompany(app, 'Parent Cross Company B')

    const userInCompanyA = await app.prisma.user.create({
      data: {
        email: `parent-cross-a-${Date.now()}@test.com`,
        password: 'hashed',
        role: 'Candidate',
        firstName: 'Parent',
        lastName: 'CrossA',
        phone: '+375291000004',
        companyId: companyA.id,
      },
    })

    const parentInCompanyB = await app.prisma.user.create({
      data: {
        email: `parent-cross-b-${Date.now()}@test.com`,
        password: 'hashed',
        role: 'Consultant',
        firstName: 'Parent',
        lastName: 'CrossB',
        phone: '+375291000005',
        companyId: companyB.id,
      },
    })

    adminUser.company.id = companyA.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/parent',
      payload: { userId: userInCompanyA.id, parentId: parentInCompanyB.id },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('successfully updates parentId to a valid user', async () => {
    const adminUser = { id: 1, email: 'admin@test.com', role: 'Admin', company: { id: 1 } }

    const app = await createApp()
    const company = await createCompany(app, 'Success Parent Update Company')

    const targetUser = await app.prisma.user.create({
      data: {
        email: `update-target-${Date.now()}@test.com`,
        password: 'hashed',
        role: 'Candidate',
        firstName: 'Target',
        lastName: 'User',
        phone: '+375291000006',
        companyId: company.id,
      },
    })

    const parentUser = await app.prisma.user.create({
      data: {
        email: `update-parent-${Date.now()}@test.com`,
        password: 'hashed',
        role: 'Consultant',
        firstName: 'Parent',
        lastName: 'User',
        phone: '+375291000007',
        companyId: company.id,
      },
    })

    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/parent',
      payload: { userId: targetUser.id, parentId: parentUser.id },
    })

    expect(response.statusCode).toBe(200)

    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.user.id).toBe(targetUser.id)
    expect(body.user.parentId).toBe(parentUser.id)
    expect(body.user.firstName).toBe('Target')
    expect(body.user.lastName).toBe('User')

    const updatedUser = await app.prisma.user.findUnique({ where: { id: targetUser.id } })
    expect(updatedUser.parentId).toBe(parentUser.id)
    expect(updatedUser.orphant).toBe(false)
  })

  it('clears orphant flag when assigning a parent to an orphan', async () => {
    const adminUser = { id: 1, email: 'admin@test.com', role: 'Admin', company: { id: 1 } }

    const app = await createApp()
    const company = await createCompany(app, 'Orphan Clear Company')

    const targetUser = await app.prisma.user.create({
      data: {
        email: `orphan-to-parent-${Date.now()}@test.com`,
        password: 'hashed',
        role: 'Candidate',
        firstName: 'Orphan',
        lastName: 'Child',
        phone: '+375291000010',
        companyId: company.id,
        orphant: true,
      },
    })

    const parentUser = await app.prisma.user.create({
      data: {
        email: `orphan-to-parent-parent-${Date.now()}@test.com`,
        password: 'hashed',
        role: 'Consultant',
        firstName: 'New',
        lastName: 'Parent',
        phone: '+375291000011',
        companyId: company.id,
      },
    })

    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/parent',
      payload: { userId: targetUser.id, parentId: parentUser.id },
    })

    expect(response.statusCode).toBe(200)

    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.user.id).toBe(targetUser.id)
    expect(body.user.parentId).toBe(parentUser.id)

    const updatedUser = await app.prisma.user.findUnique({ where: { id: targetUser.id } })
    expect(updatedUser.parentId).toBe(parentUser.id)
    expect(updatedUser.orphant).toBe(false)
  })

  it('successfully sets parentId to null', async () => {
    const adminUser = { id: 1, email: 'admin@test.com', role: 'Admin', company: { id: 1 } }

    const app = await createApp()
    const company = await createCompany(app, 'Null Parent Update Company')

    const parentUser = await app.prisma.user.create({
      data: {
        email: `null-parent-parent-${Date.now()}@test.com`,
        password: 'hashed',
        role: 'Consultant',
        firstName: 'Original',
        lastName: 'Parent',
        phone: '+375291000008',
        companyId: company.id,
      },
    })

    const targetUser = await app.prisma.user.create({
      data: {
        email: `null-parent-target-${Date.now()}@test.com`,
        password: 'hashed',
        role: 'Candidate',
        firstName: 'Target',
        lastName: 'Null',
        phone: '+375291000009',
        companyId: company.id,
        parentId: parentUser.id,
      },
    })

    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/parent',
      payload: { userId: targetUser.id, parentId: null },
    })

    expect(response.statusCode).toBe(200)

    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.user.id).toBe(targetUser.id)
    expect(body.user.parentId).toBeNull()

    const updatedUser = await app.prisma.user.findUnique({ where: { id: targetUser.id } })
    expect(updatedUser.parentId).toBeNull()
    expect(updatedUser.orphant).toBe(true)
  })

  it('returns 500 on unexpected database error', async () => {
    const adminUser = { id: 1, email: 'admin@test.com', role: 'Admin', company: { id: 1 } }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.prisma.user, 'findUnique').mockRejectedValue(new Error('Database connection failed'))

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/user/parent',
      payload: { userId: 1, parentId: 2 },
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ error: 'Ошибка обновления родителя' })
  })
})
