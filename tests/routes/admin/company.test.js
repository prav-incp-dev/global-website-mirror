import { describe, expect, it, vi } from 'vitest'
import { createNoCsrfApp as createApp } from '../../helpers'

describe('PUT /api/admin/company', () => {
  it('returns 403 when user is not authenticated', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(null)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/company',
      payload: { name: 'Test Company' },
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
      url: '/api/admin/company',
      payload: { name: 'Test Company' },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
    expect(app.auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('returns 400 when name is missing', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/company',
      payload: {},
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('required')
  })

  it('returns 400 when wallet has invalid format', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/company',
      payload: {
        name: 'Test Company',
        wallet: 'invalid-wallet',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().message).toContain('wallet')
  })

  it('returns 409 when company name is already taken', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const mockError = new Error('Unique constraint failed on the fields: (`name`)')
    mockError.code = 'P2002'

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.prisma.company, 'update').mockRejectedValue(mockError)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/company',
      payload: { name: 'Existing Company' },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Такое имя компании уже есть в системе' })
  })

  it('returns 409 when wallet is already taken', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const mockError = new Error('Unique constraint failed on the fields: (`wallet`)')
    mockError.code = 'P2002'

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.prisma.company, 'update').mockRejectedValue(mockError)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/company',
      payload: { name: 'Test Company', wallet: '0x1234567890abcdef1234567890abcdef12345678' },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Такой распределительный счет уже есть в системе' })
  })

  it('returns 409 when serviceWallet is already taken', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const mockError = new Error('Unique constraint failed on the fields: (`serviceWallet`)')
    mockError.code = 'P2002'

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.prisma.company, 'update').mockRejectedValue(mockError)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/company',
      payload: { name: 'Test Company', serviceWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Такой счет на обслуживание уже есть в системе' })
  })

  it('returns 409 when cumulativeWallet is already taken', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const mockError = new Error('Unique constraint failed on the fields: (`cumulativeWallet`)')
    mockError.code = 'P2002'

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.prisma.company, 'update').mockRejectedValue(mockError)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/company',
      payload: { name: 'Test Company', cumulativeWallet: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Такой накопительный счет уже есть в системе' })
  })

  it('returns 500 on unexpected error', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.prisma.company, 'update').mockRejectedValue(new Error('Database connection failed'))

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/company',
      payload: { name: 'Test Company' },
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ error: 'Ошибка обновления компании' })
  })

  it('returns 200 and updates company on success', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const updatedCompany = {
      id: 1,
      name: 'Updated Company',
      wallet: '0x1234567890abcdef1234567890abcdef12345678',
      serviceWallet: null,
      cumulativeWallet: null,
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.prisma.company, 'update').mockResolvedValue(updatedCompany)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/company',
      payload: {
        name: 'Updated Company',
        wallet: '0x1234567890abcdef1234567890abcdef12345678',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      success: true,
      company: {
        id: 1,
        name: 'Updated Company',
        wallet: '0x1234567890abcdef1234567890abcdef12345678',
        serviceWallet: null,
        cumulativeWallet: null,
      },
    })
    expect(app.prisma.company.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        name: 'Updated Company',
        wallet: '0x1234567890abcdef1234567890abcdef12345678',
        serviceWallet: null,
        cumulativeWallet: null,
      },
    })
  })

  it('returns 200 and updates company with serviceWallet', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const updatedCompany = {
      id: 1,
      name: 'Test Company',
      wallet: null,
      serviceWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      cumulativeWallet: null,
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.prisma.company, 'update').mockResolvedValue(updatedCompany)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/company',
      payload: {
        name: 'Test Company',
        serviceWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      success: true,
      company: {
        id: 1,
        name: 'Test Company',
        wallet: null,
        serviceWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        cumulativeWallet: null,
      },
    })
    expect(app.prisma.company.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        name: 'Test Company',
        wallet: null,
        serviceWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        cumulativeWallet: null,
      },
    })
  })

  it('returns 200 and updates company with cumulativeWallet', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const updatedCompany = {
      id: 1,
      name: 'Test Company',
      wallet: null,
      serviceWallet: null,
      cumulativeWallet: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.prisma.company, 'update').mockResolvedValue(updatedCompany)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/company',
      payload: {
        name: 'Test Company',
        cumulativeWallet: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      success: true,
      company: {
        id: 1,
        name: 'Test Company',
        wallet: null,
        serviceWallet: null,
        cumulativeWallet: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      },
    })
    expect(app.prisma.company.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        name: 'Test Company',
        wallet: null,
        serviceWallet: null,
        cumulativeWallet: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      },
    })
  })

  it('returns 200 when wallet is an empty string', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@example.com',
      role: 'Admin',
      company: { id: 1 },
    }

    const updatedCompany = {
      id: 1,
      name: 'Test Company',
      wallet: null,
      serviceWallet: null,
      cumulativeWallet: null,
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)
    vi.spyOn(app.prisma.company, 'update').mockResolvedValue(updatedCompany)

    const response = await app.inject({
      method: 'PUT',
      url: '/api/admin/company',
      payload: {
        name: 'Test Company',
        wallet: '',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      success: true,
      company: {
        id: 1,
        name: 'Test Company',
        wallet: null,
        serviceWallet: null,
        cumulativeWallet: null,
      },
    })
    expect(app.prisma.company.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        name: 'Test Company',
        wallet: null,
        serviceWallet: null,
        cumulativeWallet: null,
      },
    })
  })
})
