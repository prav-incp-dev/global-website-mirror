import { test, expect } from '../fixtures.js'
import { createTestCompany, createTestUser, getPrisma } from '../db.js'

test.describe('admin manages company settings', () => {
  let company
  let admin

  test.beforeEach(async () => {
    company = await createTestCompany('Settings Test Company')
    admin = await createTestUser({ firstName: 'Alice', lastName: 'Admin', role: 'Admin', companyId: company.id })
  })

  const openSettings = async (page) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Настройки' }).click()
    await expect(page.getByRole('heading', { name: 'Настройки' })).toBeVisible()
  }

  const saveSettings = async (page) => {
    // Wait for the actual PUT to complete; the flash text is the same for every
    // save, so a visibility check alone could match a stale flash from the
    // previous save before the current request finishes.
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/admin/settings') && res.request().method() === 'PUT' && res.status() === 200,
    )
    await page.getByRole('button', { name: 'Сохранить' }).click()
    await responsePromise
    await expect(page.getByText('Настройки сохранены')).toBeVisible()
  }

  test('edits settings on all tabs and sees the success message', async ({ loginAs, page }) => {
    await loginAs(admin.id)
    await openSettings(page)

    // Default tab: Общие настройки — update Stale Days
    await page.getByLabel('Срок бездействия для предупреждения (дней)').fill('45')
    await page.getByLabel('Срок бездействия для открепления (дней)').fill('50')
    await page.getByLabel('Комиссия за отмену платежа (%)').fill('7')
    await saveSettings(page)

    // Levels tab — change level 1 percent and level 2 plan
    await page.getByRole('button', { name: 'Настройки уровней' }).click()
    await page.getByRole('spinbutton').nth(0).fill('25')
    await page.getByRole('spinbutton').nth(5).fill('12')
    await saveSettings(page)

    // Prices tab — change 0-units and 1-unit costs
    await page.getByRole('button', { name: 'Настройки стоимостей' }).click()
    await page.getByRole('spinbutton').nth(0).fill('150')
    await page.getByRole('spinbutton').nth(1).fill('1300')
    await saveSettings(page)

    // Verify all changes persisted in the database
    const setting = await getPrisma().setting.findUnique({ where: { companyId: company.id } })
    expect(setting.general).toEqual({ staleDays: 45, orphantDays: 50, refundFee: 7 })
    expect(setting.levels[1].percent).toBe(25)
    expect(setting.levels[2].personal).toBe(12)
    expect(setting.prices[0]).toBe(150)
    expect(setting.prices[1]).toBe(1300)
  })
})
