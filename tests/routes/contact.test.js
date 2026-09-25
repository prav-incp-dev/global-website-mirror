import { beforeEach, describe, it, vi } from 'vitest'
import { createNoCsrfApp as createApp } from '../helpers'
import { UserRole } from '../../src/generated/prisma/client'
import { sendContactRequestEmail } from '../../src/services/emailService.js'

vi.mock('../../src/services/emailService.js', () => ({
  sendContactRequestEmail: vi.fn(async () => ({})),
}))

vi.mock('../../src/lib/uploads.js', () => ({
  saveUpload: vi.fn(async () => ({ storedPath: '/tmp/uploads/abc.pdf', storedName: 'abc.pdf' })),
  removeUpload: vi.fn(async () => {}),
}))

const BOUNDARY = '----contactTestBoundary'

const buildMultipart = ({ message, filename, content = 'file-content' }) => {
  const chunks = []

  // Message field first (per @fastify/multipart ordering recommendation)
  chunks.push(`--${BOUNDARY}\r\n`)
  chunks.push(`Content-Disposition: form-data; name="message"\r\n\r\n`)
  chunks.push(`${message}\r\n`)

  if (filename) {
    chunks.push(`--${BOUNDARY}\r\n`)
    chunks.push(`Content-Disposition: form-data; name="attachment"; filename="${filename}"\r\n`)
    chunks.push(`Content-Type: application/pdf\r\n\r\n`)
    chunks.push(content)
    chunks.push('\r\n')
  }

  chunks.push(`--${BOUNDARY}--\r\n`)

  const payload = Buffer.concat(chunks.map((c) => Buffer.from(c)))
  return { payload, contentType: `multipart/form-data; boundary=${BOUNDARY}` }
}

const createCompanyWithAdmin = async (app, { adminEmail, companyName } = {}) => {
  const company = await app.prisma.company.create({
    data: { name: companyName || `Contact Company ${Date.now()} ${Math.random().toString(36).slice(2, 6)}` },
  })
  const admin = await app.prisma.user.create({
    data: {
      email: adminEmail || `contact-admin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`,
      password: 'hash',
      role: UserRole.Admin,
      companyId: company.id,
      firstName: 'Admin',
      lastName: 'User',
      phone: `+375291${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`,
    },
  })
  return { company, admin }
}

const consultantUser = (companyId) => ({
  id: 1,
  role: UserRole.Consultant,
  companyId,
  email: 'consultant@test.com',
  firstName: 'John',
  lastName: 'Doe',
})

describe('POST /api/contact', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when user is not authenticated', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(null)

    const { payload, contentType } = buildMultipart({ message: 'Hello admin' })
    const response = await app.inject({
      method: 'POST',
      url: '/api/contact',
      headers: { 'content-type': contentType },
      payload,
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ error: 'Доступно только авторизованным пользователям' })
    expect(sendContactRequestEmail).not.toHaveBeenCalled()
  })

  it('returns 403 when user is an Admin', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue({ id: 1, role: UserRole.Admin })

    const { payload, contentType } = buildMultipart({ message: 'Hello admin' })
    const response = await app.inject({
      method: 'POST',
      url: '/api/contact',
      headers: { 'content-type': contentType },
      payload,
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
    expect(sendContactRequestEmail).not.toHaveBeenCalled()
  })

  it('returns 400 when the request is not multipart', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(consultantUser(1))

    const response = await app.inject({
      method: 'POST',
      url: '/api/contact',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ message: 'Hello' }),
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ error: 'Ожидается multipart-запрос' })
    expect(sendContactRequestEmail).not.toHaveBeenCalled()
  })
  it('returns 400 when the message is empty', async () => {
    const app = await createApp()
    const { company } = await createCompanyWithAdmin(app)
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(consultantUser(company.id))

    const { payload, contentType } = buildMultipart({ message: '   ' })
    const response = await app.inject({
      method: 'POST',
      url: '/api/contact',
      headers: { 'content-type': contentType },
      payload,
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ error: 'Сообщение не может быть пустым' })
    expect(sendContactRequestEmail).not.toHaveBeenCalled()
  })

  it('sends the request to all company admins without an attachment', async ({ expect }) => {
    const app = await createApp()
    const { company, admin } = await createCompanyWithAdmin(app)
    const user = consultantUser(company.id)
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(user)

    const { payload, contentType } = buildMultipart({ message: 'Hello admin' })
    const response = await app.inject({
      method: 'POST',
      url: '/api/contact',
      headers: { 'content-type': contentType },
      payload,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ success: true })

    expect(sendContactRequestEmail).toHaveBeenCalledTimes(1)
    expect(sendContactRequestEmail).toHaveBeenCalledWith({
      user,
      message: 'Hello admin',
      adminEmails: [admin.email],
      attachment: null,
    })
  })
})
