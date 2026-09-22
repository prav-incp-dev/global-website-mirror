import { test, expect } from '../../fixtures.js'
import { createTestCompany, createTestUser, getPrisma } from '../../db.js'
import fs from 'fs'
import path from 'path'

test.describe('admin clients export csv', () => {
  let admin

  test.beforeEach(async () => {
    const company = await createTestCompany('Export CSV Company')

    admin = await createTestUser({ firstName: 'Export', lastName: 'Admin', role: 'Admin', companyId: company.id })

    const consultant = await createTestUser({
      firstName: 'Export',
      lastName: 'Consultant',
      role: 'Consultant',
      companyId: company.id,
      level: 3,
    })

    await createTestUser({
      firstName: 'Export',
      lastName: 'Candidate',
      role: 'Candidate',
      companyId: company.id,
      level: 1,
    })

    const prisma = getPrisma()

    await prisma.levelHistory.create({
      data: {
        userId: consultant.id,
        oldLevel: 2,
        newLevel: 3,
        createdAt: new Date('2025-05-10'),
      },
    })

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

    await expect(page.getByText('Export Consultant')).toBeVisible()
    await expect(page.getByText('Export Candidate')).toBeVisible()

    await page.getByTitle('Выгрузка').click()

    const modalTitle = page.getByRole('heading', { name: 'Выгрузка клиентов' })
    await expect(modalTitle).toBeVisible()

    await expect(page.getByLabel('Единицы с')).toBeVisible()
    await expect(page.getByLabel('Единицы по')).toBeVisible()
    const confirmButton = page.getByRole('button', { name: 'Сформировать' })
    await expect(confirmButton).toBeVisible()
    await expect(confirmButton).toBeEnabled()

    const downloadPromise = page.waitForEvent('download')

    await confirmButton.click()

    const download = await downloadPromise
    const fileName = download.suggestedFilename()
    expect(fileName).toMatch(/^clients-.+\.csv$/)

    const tempPath = path.join('tests/fixtures', fileName)
    await download.saveAs(tempPath)

    expect(fs.existsSync(tempPath)).toBeTruthy()
    const fileStats = fs.statSync(tempPath)
    expect(fileStats.size).toBeGreaterThan(0)

    const fileContent = fs.readFileSync(tempPath, 'utf-8')

    expect(fileContent.startsWith('\uFEFF')).toBeTruthy()

    const csvLines = fileContent.replace('\uFEFF', '').split('\n').filter(Boolean)

    expect(csvLines[0]).toBe('Имя,Почта,Номер пайщика,Уровень,Дата получения уровня,Личные единицы за период,Групповые единицы за период')

    const consultantLine = csvLines.find((l) => l.includes('Export Consultant'))
    expect(consultantLine).toBeTruthy()
    expect(consultantLine).toContain('3')
    expect(consultantLine).toContain('15')
    expect(consultantLine).toContain('35')

    const candidateLine = csvLines.find((l) => l.includes('Export Candidate'))
    expect(candidateLine).toBeTruthy()
    expect(candidateLine).toContain('1')

    fs.unlinkSync(tempPath)

    await expect(modalTitle).not.toBeVisible()
  })
})
