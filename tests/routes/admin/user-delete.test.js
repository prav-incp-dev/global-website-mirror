import { describe, expect, it, vi } from 'vitest'
import { createNoCsrfApp as createApp } from '../../helpers'

const createCompany = async (app, name) => {
  return app.prisma.company.create({
    data: { name },
  })
}

const createUser = async (app, company, overrides = {}) => {
  return app.prisma.user.create({
    data: {
      email: `delete-${Date.now()}-${Math.random()}@test.com`,
      password: 'hashed',
      role: 'Candidate',
      firstName: 'Delete',
      lastName: 'Candidate',
      phone: `+375${String(Math.floor(Math.random() * 1e10)).padStart(10, '0')}`,
      companyId: company.id,
      ...overrides,
    },
  })
}

describe('DELETE /api/admin/user/:id', () => {
  it('returns 403 when user is not authenticated', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(null)

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/admin/user/1',
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
      method: 'DELETE',
      url: '/api/admin/user/2',
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('returns 400 when id param is missing', async () => {
    const adminUser = { id: 1, email: 'admin@example.com', role: 'Admin', company: { id: 1 } }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/admin/user/',
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when id is not an integer', async () => {
    const adminUser = { id: 1, email: 'admin@example.com', role: 'Admin', company: { id: 1 } }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/admin/user/abc',
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 404 when target user does not exist', async () => {
    const adminUser = { id: 1, email: 'admin@test.com', role: 'Admin', company: { id: 1 } }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/admin/user/99999',
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Пользователь не найден' })
  })

  it('returns 403 when target user is in a different company', async () => {
    const adminUser = { id: 1, email: 'admin@test.com', role: 'Admin', company: { id: 1 } }

    const app = await createApp()
    const companyA = await createCompany(app, 'Delete Cross Company A')
    const companyB = await createCompany(app, 'Delete Cross Company B')

    const userInCompanyB = await createUser(app, companyB)

    adminUser.company.id = companyA.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/admin/user/${userInCompanyB.id}`,
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('returns 400 when trying to delete a consultant', async () => {
    const adminUser = { id: 1, email: 'admin@test.com', role: 'Admin', company: { id: 1 } }

    const app = await createApp()
    const company = await createCompany(app, 'Delete Consultant Company')

    const consultant = await createUser(app, company, { role: 'Consultant' })

    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/admin/user/${consultant.id}`,
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      error: 'Пользователя можно удалить только в статусе кандидата',
    })
  })

  it('successfully deletes a candidate with no related records', async () => {
    const adminUser = { id: 1, email: 'admin@test.com', role: 'Admin', company: { id: 1 } }

    const app = await createApp()
    const company = await createCompany(app, 'Delete Success Company')

    const candidate = await createUser(app, company)

    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/admin/user/${candidate.id}`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ success: true })

    const remaining = await app.prisma.user.count({ where: { id: candidate.id } })
    expect(remaining).toBe(0)
  })

  it('returns 500 when candidate has a payment', async () => {
    const adminUser = { id: 1, email: 'admin@test.com', role: 'Admin', company: { id: 1 } }

    const app = await createApp()
    const company = await createCompany(app, 'Delete Payment Company')

    const candidate = await createUser(app, company)

    // A Payment references the user via required FKs, blocking the hard delete
    const order = await app.prisma.order.create({
      data: {
        userId: candidate.id,
        quantity: 1,
        totalAmount: 100,
        status: 'Paid',
      },
    })
    await app.prisma.payment.create({
      data: {
        userId: candidate.id,
        companyId: company.id,
        orderId: order.id,
        amount: 100,
        txHash: `delete-tx-${Date.now()}-${Math.random()}`,
        uid: `delete-uid-${Date.now()}-${Math.random()}`,
        status: 'Completed',
        tokenContract: 'test-contract',
        chainId: 1,
        tokenDecimals: 18,
        toWallet: 'test-wallet',
      },
    })

    adminUser.company.id = company.id
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/admin/user/${candidate.id}`,
    })

    expect(response.statusCode).toBe(500)
    expect(response.json().error).toMatch('Ошибка удаления пользователя')

    const remaining = await app.prisma.user.count({ where: { id: candidate.id } })
    expect(remaining).toBe(1)
  })
})
