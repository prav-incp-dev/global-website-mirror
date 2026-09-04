import { test, expect } from '../fixtures.js'
import { createTestCompany, createTestUser } from '../db.js'

test.describe('consultant profile with stats', () => {
  let parent
  let consultant

  test.beforeEach(async () => {
    const company = await createTestCompany('Consultant Profile Company')

    // Create parent consultant
    parent = await createTestUser({
      firstName: 'Bob',
      lastName: 'Parent',
      level: 8,
      role: 'Consultant',
      companyId: company.id,
    })
    consultant = await createTestUser(
      {
        firstName: 'Jim',
        lastName: 'Invited',
        role: 'Consultant',
        level: 2,
        companyId: company.id,
        parentId: parent.id,
      },
      7,
      60,
    )
  })

  test('consultant views profile, edits data, checks payments and stats', async ({ loginAs, page }) => {
    // Log in as the consultant
    await loginAs(consultant.id)

    // --- Verify invite button is visible ---
    await expect(page.getByRole('button', { name: 'Сгенерировать пригласительную ссылку' })).toBeVisible()

    // --- Verify "Ваш пригласитель" is NOT visible (only for Candidate) ---
    await expect(page.getByText('Ваш пригласитель:')).not.toBeVisible()

    // --- Verify initial profile data ---
    await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible()
    await expect(page.getByText('Jim', { exact: true })).toBeVisible()
    await expect(page.getByText('Invited', { exact: true })).toBeVisible()
    await expect(page.getByText(consultant.email)).toBeVisible()

    // --- Verify balance button is visible (consultant has wallet)
    await expect(page.getByRole('button', { name: 'Проверить баланс' })).toBeVisible()

    // Mock balance API to always fail (avoids dependency on real RPC)
    await page.route('**/api/user/balance', (route) => {
      route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Не удалось получить баланс' }),
      })
    })

    await page.getByRole('button', { name: 'Проверить баланс' }).click()
    await expect(page.getByText('Не удалось получить баланс')).toBeVisible()

    // --- Edit profile ---
    await page.getByRole('button', { name: 'Редактировать' }).click()
    await page.locator('#firstName').fill('UpdatedJim')
    await page.locator('#wallet').fill('')
    await page.getByRole('button', { name: 'Сохранить' }).click()

    // --- Verify updated data ---
    await expect(page.getByText('UpdatedJim')).toBeVisible()
    // --- Verify balance button is no longer visible (consultant removed wallet)
    await expect(page.getByRole('button', { name: 'Проверить баланс' })).not.toBeVisible()

    // --- Navigate to Покупки tab ---
    await page.getByRole('button', { name: 'Покупки' }).click()
    await expect(page.getByRole('button', { name: 'Купить' })).toBeVisible()

    // --- Navigate to Статистика tab ---
    await page.getByRole('button', { name: 'Статистика' }).click()

    // --- Verify first table: level, score, groupScore ---
    await expect(page.getByRole('cell', { name: consultant.level })).toBeVisible()
    await expect(page.getByRole('cell', { name: '7' })).toBeVisible()
    await expect(page.getByRole('cell', { name: '60' })).toBeVisible()

    // --- Verify Пригласитель section ---
    await expect(page.getByRole('heading', { name: 'Пригласитель' })).toBeVisible()
    await expect(page.getByRole('cell', { name: parent.nick })).toBeVisible()
    // Parent level = 3 should be in the same row as @parentcons
    await expect(page.getByText('Пригласитель').locator('..').getByRole('cell', { name: parent.level })).toBeVisible()
  })
})
