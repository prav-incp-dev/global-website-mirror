import { test, describe, vi, beforeEach, afterEach } from 'vitest'

describe('emailService in production mode', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('SMTP_HOST', 'smtp.example.com')
    vi.stubEnv('SMTP_PORT', '587')
    vi.stubEnv('SMTP_USER', 'user@example.com')
    vi.stubEnv('SMTP_PASS', 'secret')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('createTransport uses real SMTP transport when NODE_ENV is not test', async ({ expect }) => {
    const mockTransport = { sendMail: vi.fn().mockResolvedValue({}) }
    // Need to mock the default export since emailService uses `import nodemailer from 'nodemailer'`
    vi.doMock('nodemailer', () => ({
      default: {
        createTransport: vi.fn(() => mockTransport),
      },
    }))

    // Use dynamic import so the mock is applied
    const { sendTwoFactorCode } = await import('@/services/emailService')
    const nodemailer = await import('nodemailer')

    const user = { email: 'test@example.com', firstName: 'Test', lastName: 'User' }
    await sendTwoFactorCode(user, '123456')

    expect(nodemailer.default.createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: {
        user: 'user@example.com',
        pass: 'secret',
      },
    })
  })
})
