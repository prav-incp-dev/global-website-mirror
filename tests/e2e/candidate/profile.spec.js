import { test, expect } from '../fixtures.js'
import { createTestCompany, createTestUser } from '../db.js'

test.describe('consultant manages own profile', () => {
  let parent
  let candidate

  test.beforeEach(async () => {
    const company = await createTestCompany('Candidate Profile Company')
    parent = await createTestUser({ firstName: 'Consultant', lastName: 'Inviter', companyId: company.id })
    candidate = await createTestUser({
      firstName: 'Candidate',
      lastName: 'User',
      role: 'Candidate',
      companyId: company.id,
      parentId: parent.id,
    })
  })

  test('views profile with inviter, edits data, and verifies email persists', async ({ loginAs, page }) => {
    // Log in as consultant
    await loginAs(candidate.id)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('button', { name: 'Сгенерировать пригласительную ссылку' })).not.toBeVisible()
    // --- VIEW MODE: Verify initial data ---
    await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible()
    await expect(page.getByText('Candidate', { exact: true })).toBeVisible()
    await expect(page.getByText('User', { exact: true })).toBeVisible()
    await expect(page.getByText(candidate.email)).toBeVisible()
    await expect(page.getByText(candidate.phone)).toBeVisible()
    await expect(page.getByText(candidate.memberId)).toBeVisible()

    // --- Verify balance button is visible (candidate has wallet)
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

    // Verify inviter field
    await expect(page.getByText('Ваш пригласитель:')).toBeVisible()
    await expect(page.getByText(parent.nick)).toBeVisible()

    // --- EDIT MODE: Update profile ---
    await page.getByRole('button', { name: 'Редактировать' }).click()

    await page.locator('#firstName').fill('UpdatedFirst')
    await page.locator('#lastName').fill('UpdatedLast')
    await page.locator('#phone').fill('+375290000044')
    await page.locator('#memberId').fill('DOM-00000000-0099')
    await page.locator('#nick').fill('@invited')
    await page.locator('#wallet').fill('0x1234567890abcdef1234567890abcdef33333333')

    await page.getByRole('button', { name: 'Сохранить' }).click()

    // --- VIEW MODE: Verify updated data ---
    await expect(page.getByText('UpdatedFirst')).toBeVisible()
    await expect(page.getByText('UpdatedLast')).toBeVisible()
    await expect(page.getByText('+375290000044')).toBeVisible()
    await expect(page.getByText('DOM-00000000-0099')).toBeVisible()
    await expect(page.getByText('@invited')).toBeVisible()
    await expect(page.getByText('0x12345678...33333333')).toBeVisible()

    // Email should still be present (not on edit form, so unchanged)
    await expect(page.getByText(candidate.email)).toBeVisible()

    // --- Navigate to Покупки tab and back to Профиль ---
    await page.getByRole('button', { name: 'Покупки' }).click()
    await page.getByRole('button', { name: 'Профиль' }).click()

    // --- Verify data persisted after tab switch ---
    await expect(page.getByText('UpdatedFirst')).toBeVisible()
    await expect(page.getByText('UpdatedLast')).toBeVisible()
    await expect(page.getByText('+375290000044')).toBeVisible()
    await expect(page.getByText('0099')).toBeVisible()
    await expect(page.getByText('@invited')).toBeVisible()
    await expect(page.getByText('0x12345678...33333333')).toBeVisible()
    await expect(page.getByText(candidate.email)).toBeVisible()
  })
})
