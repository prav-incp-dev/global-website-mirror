import { test, expect } from '../../fixtures.js'
import { createTestCompany, createTestUser, getPrisma } from '../../db.js'

test.describe('admin clients export csv', () => {
  let admin

  test.beforeEach(async () => {
    const company = await createTestCompany('Export CSV Company')

    admin = await createTestUser({ firstName: 'Export', lastName: 'Admin', role: 'Admin', companyId: company.id })

    // Consultant with wage records and level history
    const consultant = await createTestUser({
      firstName: 'Export',
      lastName: 'Consultant',
      role: 'Consultant',
      companyId: company.id,
      level: 3,
    })

    // Candidate — should also appear in export
    await createTestUser({
      firstName: 'Export',
      lastName: 'Candidate',
      role: 'Candidate',
      companyId: company.id,
      level: 1,
    })

    const prisma = getPrisma()

    // LevelHistory: consultant reached level 3 on 2025-05-10
    await prisma.levelHistory.create({
      data: {
        userId: consultant.id,
        oldLevel: 2,
        newLevel: 3,
        createdAt: new Date('2025-05-10'),
      },
    })

    // Wages inside the default date range (last 30 days from now)
    await prisma.wage.create({
      data: {
        companyId: company.id,
        userId: consultant.id,
        score: 10,
        groupScore: 20,
        amount: 0,
        createdAt: new Date(),
      },
    })
    await prisma.wage.create({
      data: {
        companyId: company.id,
        userId: consultant.id,
        score: 5,
        groupScore: 15,
        amount: 0,
        createdAt: new Date(),
      },
    })
  })

  test('export clients csv flow', async ({ loginAs, page }) => {
    await loginAs(admin.id)
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Клиенты' }).click()
    await page.waitForLoadState('networkidle')

    // Both users are visible in the table
    await expect(page.getByText('Export Consultant')).toBeVisible()
    await expect(page.getByText('Export Candidate')).toBeVisible()

    // Click the download button
    await page.getByTitle('Выгрузить отчет').click()

    // The ExportModal opens
    const modalTitle = page.getByRole('heading', { name: 'Выгрузка клиентов' })
    await expect(modalTitle).toBeVisible()

    // Date inputs and the confirm button are present
    await expect(page.getByLabel('Дата от')).toBeVisible()
    await expect(page.getByLabel('Дата до')).toBeVisible()
    const confirmButton = page.getByRole('button', { name: 'Сформировать' })
    await expect(confirmButton).toBeVisible()
    await expect(confirmButton).toBeEnabled()

    // Intercept the export request
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/admin/clients/export') && response.status() === 200,
    )

    // Click "Сформировать"
    await confirmButton.click()

    // Wait for the response and verify it
    const response = await responsePromise
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toBe('text/csv; charset=utf-8')
    expect(response.headers()['content-disposition']).toMatch(/^attachment; filename="clients-.+\.csv"$/)

    const csvText = await response.text()

    // CSV starts with BOM
    expect(csvText.startsWith('\uFEFF')).toBe(true)

    const lines = csvText.replace('\uFEFF', '').split('\n').filter(Boolean)

    // Header row
    expect(lines[0]).toBe('Имя,Почта,Номер пайщика,Уровень,Дата получения уровня,Личные единицы за период,Групповые единицы за период')

    // Both users appear in the CSV (order may vary, check by unique fields)
    const consultantLine = lines.find((l) => l.includes('Export Consultant'))
    expect(consultantLine).toBeTruthy()
    expect(consultantLine).toContain('3') // level
    expect(consultantLine).toContain('15') // wageScore (10 + 5)
    expect(consultantLine).toContain('35') // wageGroupScore (20 + 15)

    const candidateLine = lines.find((l) => l.includes('Export Candidate'))
    expect(candidateLine).toBeTruthy()
    expect(candidateLine).toContain('1') // level

    // The modal closed after submitting
    await expect(modalTitle).not.toBeVisible()
  })
})

