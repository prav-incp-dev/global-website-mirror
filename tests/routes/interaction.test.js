import { beforeAll, describe, expect, it, onTestFinished, vi } from 'vitest'
import { UserRole } from '@/generated/prisma/client'
import { createNoCsrfApp as createApp } from '../helpers'

const SESSION_SECRET = 'test-secret-key-for-testing-purposes'

beforeAll(() => {
  vi.stubEnv('SESSION_SECRET', SESSION_SECRET)
})

const baseUser = {
  password: 'hash',
  companyId: 1,
}

let createdIds = []
let createdInteractionIds = []

const withCleanup = (createFn) => {
  return async (...args) => {
    const result = await createFn(...args)
    createdIds.push(result.id)
    return result
  }
}

const withInteractionCleanup = (createFn) => {
  return async (...args) => {
    const result = await createFn(...args)
    createdInteractionIds.push(result.id)
    return result
  }
}

const deleteAllCreated = async (app) => {
  await app.prisma.interaction.deleteMany({ where: { id: { in: createdInteractionIds } } })
  await app.prisma.user.deleteMany({ where: { id: { in: createdIds } } })
  createdIds = []
  createdInteractionIds = []
}

describe('POST /api/interaction/complete', () => {
  it('returns 401 when user is not authenticated', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(null)

    const response = await app.inject({
      method: 'POST',
      url: '/api/interaction/complete',
      payload: {
        completedAt: '2026-08-15T10:00:00Z',
        description: 'Test interaction',
        targetId: 1,
      },
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ error: 'Доступно только авторизованным пользователям' })
  })

  it('returns 403 when user is a Candidate', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue({ id: 1, role: UserRole.Candidate })

    const response = await app.inject({
      method: 'POST',
      url: '/api/interaction/complete',
      payload: {
        completedAt: '2026-08-15T10:00:00Z',
        description: 'Test interaction',
        targetId: 1,
      },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('creates a new interaction when no open one exists', async ({ expect }) => {
    const app = await createApp()
    onTestFinished(async () => {
      await deleteAllCreated(app)
    })

    const consultant = await withCleanup((data) => app.prisma.user.create({ data }))({
      ...baseUser,
      role: UserRole.Consultant,
      email: `interaction-create-consultant-${Date.now()}@test.com`,
      phone: `+10000001${String(Date.now()).slice(-4)}`,
    })

    const target = await withCleanup((data) => app.prisma.user.create({ data }))({
      ...baseUser,
      role: UserRole.Candidate,
      email: `interaction-create-target-${Date.now()}@test.com`,
      phone: `+10000002${String(Date.now()).slice(-4)}`,
    })

    vi.spyOn(app.auth, 'getUser').mockResolvedValue(consultant)

    const completedAt = '2026-08-15T10:00:00Z'
    const description = 'Completed onboarding call'

    const response = await app.inject({
      method: 'POST',
      url: '/api/interaction/complete',
      payload: {
        completedAt,
        description,
        targetId: target.id,
      },
    })

    expect(response.statusCode).toBe(200)

    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.interaction.status).toBe('Closed')
    expect(body.interaction.description).toBe(description)
    expect(body.interaction.targetId).toBe(target.id)
    expect(body.interaction.initiatorId).toBe(consultant.id)
    expect(new Date(body.interaction.completedAt).toISOString()).toBe(new Date(completedAt).toISOString())
    expect(new Date(body.interaction.plannedAt).toISOString()).toBe(new Date(completedAt).toISOString())

    createdInteractionIds.push(body.interaction.id)
  })

  it('updates existing open interaction when one exists', async ({ expect }) => {
    const app = await createApp()
    onTestFinished(async () => {
      await deleteAllCreated(app)
    })

    const consultant = await withCleanup((data) => app.prisma.user.create({ data }))({
      ...baseUser,
      role: UserRole.Consultant,
      email: `interaction-update-consultant-${Date.now()}@test.com`,
      phone: `+10000003${String(Date.now()).slice(-4)}`,
    })

    const target = await withCleanup((data) => app.prisma.user.create({ data }))({
      ...baseUser,
      role: UserRole.Candidate,
      email: `interaction-update-target-${Date.now()}@test.com`,
      phone: `+10000004${String(Date.now()).slice(-4)}`,
    })

    // Create an existing open interaction
    const existing = await withInteractionCleanup((data) => app.prisma.interaction.create({ data }))({
      status: 'Open',
      plannedAt: new Date('2026-08-20T14:00:00Z'),
      completedAt: null,
      description: 'Scheduled call',
      initiatorId: consultant.id,
      targetId: target.id,
    })

    vi.spyOn(app.auth, 'getUser').mockResolvedValue(consultant)

    const completedAt = '2026-08-15T10:00:00Z'
    const description = 'Call completed'

    const response = await app.inject({
      method: 'POST',
      url: '/api/interaction/complete',
      payload: {
        completedAt,
        description,
        targetId: target.id,
      },
    })

    expect(response.statusCode).toBe(200)

    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.interaction.id).toBe(existing.id)
    expect(body.interaction.status).toBe('Closed')
    expect(body.interaction.description).toBe(description)
    expect(new Date(body.interaction.completedAt).toISOString()).toBe(new Date(completedAt).toISOString())
    // plannedAt should remain unchanged from the original
    expect(new Date(body.interaction.plannedAt).toISOString()).toBe(new Date('2026-08-20T14:00:00Z').toISOString())
  })

  it('returns 400 when completedAt is in the future', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue({ id: 1, role: UserRole.Consultant })

    const response = await app.inject({
      method: 'POST',
      url: '/api/interaction/complete',
      payload: {
        completedAt: new Date(Date.now() + 86400000).toISOString(),
        description: 'Test',
        targetId: 1,
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ error: 'Дата завершения не может быть в будущем' })
  })

  it('allows Admin user to complete interaction', async ({ expect }) => {
    const app = await createApp()
    onTestFinished(async () => {
      await deleteAllCreated(app)
    })

    const admin = await withCleanup((data) => app.prisma.user.create({ data }))({
      ...baseUser,
      role: UserRole.Admin,
      email: `interaction-admin-${Date.now()}@test.com`,
      phone: `+10000005${String(Date.now()).slice(-4)}`,
    })

    const target = await withCleanup((data) => app.prisma.user.create({ data }))({
      ...baseUser,
      role: UserRole.Candidate,
      email: `interaction-admin-target-${Date.now()}@test.com`,
      phone: `+10000006${String(Date.now()).slice(-4)}`,
    })

    vi.spyOn(app.auth, 'getUser').mockResolvedValue(admin)

    const response = await app.inject({
      method: 'POST',
      url: '/api/interaction/complete',
      payload: {
        completedAt: '2026-08-15T10:00:00Z',
        description: 'Admin completed interaction',
        targetId: target.id,
      },
    })

    expect(response.statusCode).toBe(200)

    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.interaction.status).toBe('Closed')
    expect(body.interaction.initiatorId).toBe(admin.id)

    createdInteractionIds.push(body.interaction.id)
  })
})

describe('POST /api/interaction/schedule', () => {
  it('returns 401 when user is not authenticated', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue(null)

    const response = await app.inject({
      method: 'POST',
      url: '/api/interaction/schedule',
      payload: {
        plannedAt: '2026-09-01T10:00:00Z',
        targetId: 1,
      },
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ error: 'Доступно только авторизованным пользователям' })
  })

  it('returns 403 when user is a Candidate', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue({ id: 1, role: UserRole.Candidate })

    const response = await app.inject({
      method: 'POST',
      url: '/api/interaction/schedule',
      payload: {
        plannedAt: '2026-09-01T10:00:00Z',
        targetId: 1,
      },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Доступ запрещен' })
  })

  it('creates a new open interaction when no open one exists', async ({ expect }) => {
    const app = await createApp()
    onTestFinished(async () => {
      await deleteAllCreated(app)
    })

    const consultant = await withCleanup((data) => app.prisma.user.create({ data }))({
      ...baseUser,
      role: UserRole.Consultant,
      email: `interaction-schedule-create-consultant-${Date.now()}@test.com`,
      phone: `+10000007${String(Date.now()).slice(-4)}`,
    })

    const target = await withCleanup((data) => app.prisma.user.create({ data }))({
      ...baseUser,
      role: UserRole.Candidate,
      email: `interaction-schedule-create-target-${Date.now()}@test.com`,
      phone: `+10000008${String(Date.now()).slice(-4)}`,
    })

    vi.spyOn(app.auth, 'getUser').mockResolvedValue(consultant)

    const plannedAt = '2026-09-01T14:00:00Z'

    const response = await app.inject({
      method: 'POST',
      url: '/api/interaction/schedule',
      payload: {
        plannedAt,
        targetId: target.id,
      },
    })

    expect(response.statusCode).toBe(200)

    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.interaction.status).toBe('Open')
    expect(body.interaction.targetId).toBe(target.id)
    expect(body.interaction.initiatorId).toBe(consultant.id)
    expect(body.interaction.completedAt).toBeNull()
    expect(body.interaction.reminderSent).toBe(false)
    expect(new Date(body.interaction.plannedAt).toISOString()).toBe(new Date(plannedAt).toISOString())

    createdInteractionIds.push(body.interaction.id)
  })

  it('updates plannedAt on existing open interaction', async ({ expect }) => {
    const app = await createApp()
    onTestFinished(async () => {
      await deleteAllCreated(app)
    })

    const consultant = await withCleanup((data) => app.prisma.user.create({ data }))({
      ...baseUser,
      role: UserRole.Consultant,
      email: `interaction-consultant-${Date.now()}@test.com`,
      phone: `+10000009${String(Date.now()).slice(-4)}`,
    })

    const target = await withCleanup((data) => app.prisma.user.create({ data }))({
      ...baseUser,
      role: UserRole.Candidate,
      email: `interaction-candidate-${Date.now()}@test.com`,
      phone: `+10000010${String(Date.now()).slice(-4)}`,
    })

    // Create an existing open interaction with reminderSent already sent
    const existing = await withInteractionCleanup((data) => app.prisma.interaction.create({ data }))({
      status: 'Open',
      plannedAt: new Date('2026-09-10T10:00:00Z'),
      completedAt: null,
      description: 'Scheduled call',
      initiatorId: consultant.id,
      targetId: target.id,
      reminderSent: true,
    })

    vi.spyOn(app.auth, 'getUser').mockResolvedValue(consultant)

    const newPlannedAt = '2026-09-15T10:00:00Z'

    const response = await app.inject({
      method: 'POST',
      url: '/api/interaction/schedule',
      payload: {
        plannedAt: newPlannedAt,
        targetId: target.id,
      },
    })

    expect(response.statusCode).toBe(200)

    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.interaction.id).toBe(existing.id)
    expect(body.interaction.status).toBe('Open')
    expect(body.interaction.reminderSent).toBe(false)
    expect(new Date(body.interaction.plannedAt).toISOString()).toBe(new Date(newPlannedAt).toISOString())
  })

  it('returns 400 when plannedAt is in the past', async () => {
    const app = await createApp()
    vi.spyOn(app.auth, 'getUser').mockResolvedValue({ id: 1, role: UserRole.Consultant })

    const response = await app.inject({
      method: 'POST',
      url: '/api/interaction/schedule',
      payload: {
        plannedAt: new Date(Date.now() - 86400000).toISOString(),
        targetId: 1,
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ error: 'Дата планирования не может быть в прошлом' })
  })

  it('allows Admin user to schedule interaction', async ({ expect }) => {
    const app = await createApp()
    onTestFinished(async () => {
      await deleteAllCreated(app)
    })

    const admin = await withCleanup((data) => app.prisma.user.create({ data }))({
      ...baseUser,
      role: UserRole.Admin,
      email: `interaction-admin-${Date.now()}@test.com`,
      phone: `+10000011${String(Date.now()).slice(-4)}`,
    })

    const target = await withCleanup((data) => app.prisma.user.create({ data }))({
      ...baseUser,
      role: UserRole.Candidate,
      email: `interaction-target-${Date.now()}@test.com`,
      phone: `+10000012${String(Date.now()).slice(-4)}`,
    })

    vi.spyOn(app.auth, 'getUser').mockResolvedValue(admin)

    const response = await app.inject({
      method: 'POST',
      url: '/api/interaction/schedule',
      payload: {
        plannedAt: '2026-09-20T10:00:00Z',
        targetId: target.id,
      },
    })

    expect(response.statusCode).toBe(200)

    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.interaction.status).toBe('Open')
    expect(body.interaction.initiatorId).toBe(admin.id)

    createdInteractionIds.push(body.interaction.id)
  })
})
