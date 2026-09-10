import { describe, expect, it, vi } from 'vitest'
import { createNoCsrfApp as createApp } from '../../helpers'
import { adminUser, candidateUser } from './fixtures.js'

vi.mock('../../../src/lib/chain.js', () => ({
  getPublicClient: vi.fn(() => ({ getTransactionReceipt: vi.fn() })),
  getWalletClient: vi.fn(),
  ensureChain: vi.fn(),
  rpcUrl: 'https://mock-rpc.example.com',
  chainId: 97,
  usdtAddress: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd',
  usdtDecimals: 18,
  erc20Abi: [],
}))

const SETTING_FIXTURE = {
  id: 1,
  companyId: 1,
  general: {},
  levels: {},
  prices: { 0: 100, 1: 1200, 2: 2400, 3: 3600, 4: 4800, 5: 6000 },
}

const mockSettingFindUnique = (app, setting = SETTING_FIXTURE) => {
  vi.spyOn(app.prisma.setting, 'findUnique').mockResolvedValue(setting)
}

describe('POST /api/payments/init', () => {
  it('returns 403 when user is not authenticated', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(null)

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/init',
      payload: {
        quantity: 1,
      },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('returns 403 when user is Admin', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(adminUser)

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/init',
      payload: {
        quantity: 1,
      },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('returns 409 when company wallet is missing', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue({
      ...candidateUser,
      company: { id: 1, wallet: null },
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/init',
      payload: {
        quantity: 1,
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'У компании не указан кошелек для приема платежей' })
  })

  it('returns 400 when no setting with prices exists for the company', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(candidateUser)
    vi.spyOn(app.prisma.setting, 'findUnique').mockResolvedValue(null)

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/init',
      payload: {
        quantity: 1,
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ error: 'Для выбранного количества не настроена цена' })
  })

  it('returns 400 when price is not configured for the requested quantity', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(candidateUser)
    mockSettingFindUnique(app, { ...SETTING_FIXTURE, prices: { 0: 100, 1: 1200 } })

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/init',
      payload: {
        quantity: 3,
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ error: 'Для выбранного количества не настроена цена' })
  })

  it('creates pending order and payment', async () => {
    const createdOrder = {
      id: 7,
      payment: {
        id: 11,
      },
    }

    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(candidateUser)
    mockSettingFindUnique(app)
    vi.spyOn(app.prisma.order, 'create').mockResolvedValue(createdOrder)

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/init',
      payload: {
        quantity: 1,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      paymentId: 11,
      orderId: 7,
      amountUsd: 1200,
    })
    expect(app.prisma.setting.findUnique).toHaveBeenCalledWith({
      where: { companyId: 1 },
    })
    expect(app.prisma.order.create).toHaveBeenCalledTimes(1)
  })

  it('returns 500 on unexpected error', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(candidateUser)
    mockSettingFindUnique(app)
    vi.spyOn(app.prisma.order, 'create').mockRejectedValue(new Error('db unavailable'))

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/init',
      payload: {
        quantity: 1,
      },
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ error: 'Ошибка создания платежа' })
  })
})
