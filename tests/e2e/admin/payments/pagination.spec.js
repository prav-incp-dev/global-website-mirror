import { test, expect } from '../../fixtures.js'
import { createTestCompany, createTestUser, createTestOrder } from '../../db.js'

test.describe('admin payments page', () => {
  let admin

  test.beforeEach(async () => {
    // Create a separate company for this test to avoid data interference
    const company = await createTestCompany('Admin Payments Company')

    // Create admin user for this company
    admin = await createTestUser({ firstName: 'Alice', lastName: 'Admin', role: 'Admin', companyId: company.id })

    // Create candidate to be the payer
    const candidate = await createTestUser({
      firstName: 'Pay',
      lastName: 'User',
      role: 'Candidate',
      companyId: company.id,
    })

    // Create 25 payments (amounts 101..125) so page 1 shows 20 and page 2 shows 5.
    // Default sort is id descending, so the newest payment (amount 125) is first.
    for (let i = 1; i <= 25; i++) {
      await createTestOrder(company, candidate, 100 + i, 'Completed')
    }
  })

  test('payments page shows pagination and navigates between pages', async ({ loginAs, page }) => {
    // 1. Login as admin and open the admin panel
    await loginAs(admin.id)
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Панель администратора' })).toBeVisible()

    // 2. Click 'Платежи' tab
    await page.getByRole('button', { name: 'Платежи' }).click()
    await page.waitForLoadState('networkidle')

    // 3. Verify initial state — 20 records on page 1, pagination visible
    const rows = page.locator('table tbody tr')
    await expect(rows).toHaveCount(20)

    // Pagination shows "1 из 2"
    await expect(page.getByText('1 из 2')).toBeVisible()

    // 'Вперёд' is enabled, 'Назад' is disabled
    const backButton = page.getByRole('button', { name: 'Назад' })
    const forwardButton = page.getByRole('button', { name: 'Вперёд' })
    await expect(backButton).toBeDisabled()
    await expect(forwardButton).toBeEnabled()

    // Newest payment (amount 125) is the first row by default (id descending)
    await expect(rows.first()).toContainText('125')

    // 4. Click 'Вперёд' — navigate to page 2
    await forwardButton.click()
    await page.waitForLoadState('networkidle')

    // Only 5 records remain
    await expect(rows).toHaveCount(5)
    await expect(page.getByText('2 из 2')).toBeVisible()

    // 'Вперёд' is disabled, 'Назад' is enabled
    await expect(page.getByRole('button', { name: 'Назад' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Вперёд' })).toBeDisabled()

    // Oldest payments (amounts 101..105) are visible, newest (125) is gone
    await expect(rows.first()).toContainText('105')
    await expect(page.getByText('125')).not.toBeVisible()

    // 5. Click 'Назад' — return to page 1
    await page.getByRole('button', { name: 'Назад' }).click()
    await page.waitForLoadState('networkidle')

    // Back to 20 records on page 1 with pagination
    await expect(rows).toHaveCount(20)
    await expect(page.getByText('1 из 2')).toBeVisible()
    await expect(rows.first()).toContainText('125')
  })
})