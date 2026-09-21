import { describe, expect, it, vi } from 'vitest'
import { createNoCsrfApp as createApp } from '../../helpers'

const adminUser = {
  id: 1,
  email: 'admin@example.com',
  role: 'Admin',
  company: { id: 1 },
}

const nonAdminUser = {
  id: 2,
  email: 'user@example.com',
  role: 'Candidate',
  company: { id: 1 },
}

const mockClients = [
  { firstName: 'Alice', lastName: 'Smith', email: 'alice@test.com', memberId: 'M-001', level: 2, levelDate: '10.05.2025', wageScore: 15, wageGroupScore: 35 },
  { firstName: 'Bob', lastName: 'Jones', email: 'bob@test.com', memberId: 'M-002', level: 1, levelDate: '', wageScore: 0, wageGroupScore: 0 },
]

describe('GET /api/admin/clients/export', () => {
  it('returns 403 when user is not authenticated', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(null)

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/clients/export?fromDate=2025-01-01&toDate=2025-12-31',
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
    expect(app.auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('returns 403 when user is not Admin', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(nonAdminUser)

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/clients/export?fromDate=2025-01-01&toDate=2025-12-31',
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
    expect(app.auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('returns CSV with correct headers and data', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.admin, 'exportClients').mockResolvedValue(mockClients)

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/clients/export?fromDate=2025-01-01&toDate=2025-12-31',
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toBe('text/csv; charset=utf-8')
    expect(response.headers['content-disposition']).toBe('attachment; filename="clients-2025-01-01-2025-12-31.csv"')

    const body = response.body
    expect(body.startsWith('\uFEFF')).toBe(true)

    const lines = body.replace('\uFEFF', '').split('\n')
    expect(lines[0]).toBe('Имя,Почта,Номер пайщика,Уровень,Дата получения уровня,Личные единицы за период,Групповые единицы за период')
    expect(lines[1]).toBe('Alice Smith,alice@test.com,M-001,2,10.05.2025,15,35')
    expect(lines[2]).toBe('Bob Jones,bob@test.com,M-002,1,,0,0')
    expect(lines[3]).toBe('')
  })

  it('passes all query parameters to exportClients', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    const spy = vi.spyOn(app.admin, 'exportClients').mockResolvedValue([])

    await app.inject({
      method: 'GET',
      url: '/api/admin/clients/export?fromDate=2025-06-01&toDate=2025-07-31&query=Alice&orphansOnly=true&sortBy=level&fromLevel=2&toLevel=8',
    })

    expect(spy).toHaveBeenCalledWith(adminUser, '2025-06-01', '2025-07-31', 'Alice', true, 'level', 2, 8)
  })

  it('uses defaults when only required params are provided', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    const spy = vi.spyOn(app.admin, 'exportClients').mockResolvedValue([])

    await app.inject({
      method: 'GET',
      url: '/api/admin/clients/export?fromDate=2025-01-01&toDate=2025-12-31',
    })

    expect(spy).toHaveBeenCalledWith(adminUser, '2025-01-01', '2025-12-31', '', false, 'id', 0, 10)
  })

  it('returns CSV with only header row when no clients match', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.admin, 'exportClients').mockResolvedValue([])

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/clients/export?fromDate=2025-01-01&toDate=2025-12-31',
    })

    const body = response.body
    expect(body.startsWith('\uFEFF')).toBe(true)

    const lines = body.replace('\uFEFF', '').split('\n')
    expect(lines[0]).toBe('Имя,Почта,Номер пайщика,Уровень,Дата получения уровня,Личные единицы за период,Групповые единицы за период')
    expect(lines[1]).toBe('')
  })
})
