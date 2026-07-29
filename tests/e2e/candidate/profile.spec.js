import { test, expect } from '../fixtures.js'

test.describe('consultant manages own profile', () => {
  test('views profile with inviter, edits data, and verifies email persists', async ({ loginAs, page }) => {
    // Log in as consultant (userId=3 after seed change)
    await loginAs(3)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('button', { name: 'Сгенерировать пригласительную ссылку' })).not.toBeVisible()
    // --- VIEW MODE: Verify initial data ---
    await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible()
    await expect(page.getByText('Candidate', { exact: true })).toBeVisible()
    await expect(page.getByText('User')).toBeVisible()
    await expect(page.getByText('candidate@example.com')).toBeVisible()
    await expect(page.getByText('+375290000033')).toBeVisible()
    await expect(page.getByText('0003', { exact: true })).toBeVisible()

    // Verify inviter field
    await expect(page.getByText('Ваш пригласитель:')).toBeVisible()
    await expect(page.getByText('@inviter')).toBeVisible()

    // --- EDIT MODE: Update profile ---
    await page.getByRole('button', { name: 'Редактировать' }).click()

    await page.locator('#firstName').fill('UpdatedFirst')
    await page.locator('#lastName').fill('UpdatedLast')
    await page.locator('#phone').fill('+375290000044')
    await page.locator('#memberId').fill('0099')
    await page.locator('#nick').fill('@invited')
    await page.locator('#wallet').fill('0x1234567890abcdef1234567890abcdef33333333')

    await page.getByRole('button', { name: 'Сохранить' }).click()

    // --- VIEW MODE: Verify updated data ---
    await expect(page.getByText('UpdatedFirst')).toBeVisible()
    await expect(page.getByText('UpdatedLast')).toBeVisible()
    await expect(page.getByText('+375290000044')).toBeVisible()
    await expect(page.getByText('0099')).toBeVisible()
    await expect(page.getByText('@invited')).toBeVisible()
    await expect(page.getByText('0x1234567890abcdef1234567890abcdef33333333')).toBeVisible()

    // Email should still be present (not on edit form, so unchanged)
    await expect(page.getByText('candidate@example.com')).toBeVisible()

    // --- Navigate to Платежи tab and back to Профиль ---
    await page.getByRole('button', { name: 'Платежи' }).click()
    await page.getByRole('button', { name: 'Профиль' }).click()

    // --- Verify data persisted after tab switch ---
    await expect(page.getByText('UpdatedFirst')).toBeVisible()
    await expect(page.getByText('UpdatedLast')).toBeVisible()
    await expect(page.getByText('+375290000044')).toBeVisible()
    await expect(page.getByText('0099')).toBeVisible()
    await expect(page.getByText('@invited')).toBeVisible()
    await expect(page.getByText('0x1234567890abcdef1234567890abcdef33333333')).toBeVisible()
    await expect(page.getByText('candidate@example.com')).toBeVisible()
  })
})
