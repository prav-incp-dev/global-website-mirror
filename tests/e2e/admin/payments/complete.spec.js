import { test, expect } from '../../fixtures.js'
import { createTestCompany, createTestUser, createTestOrder } from '../../db.js'

test.describe('admin payments complete', () => {
  let admin
  let company

  test.beforeEach(async () => {
    company = await createTestCompany('Payments Complete Company')
    admin = await createTestUser({ firstName: 'Alice', lastName: 'Admin', role: 'Admin', companyId: company.id })
  })

  const openPaymentsTab = async (page) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Платежи' }).click()
    await page.waitForLoadState('networkidle')
  }

  test('completed payment has no complete button, failed payment can be completed', async ({ loginAs, page }) => {
    const candidate = await createTestUser({
      firstName: 'Complete',
      lastName: 'User',
      role: 'Candidate',
      companyId: company.id,
    })

    // Create one completed and one failed payment (amounts are used to identify the rows)
    await createTestOrder(company, candidate, 100, 'Completed')
    await createTestOrder(company, candidate, 200, 'Failed')

    await loginAs(admin.id)
    await openPaymentsTab(page)

    const rows = page.locator('table tbody tr')
    const infoTable = page.locator('[class*="infoTable"]')
    const modalTitle = page.getByRole('heading', { name: 'Информация о платеже' })

    // Admin sees both payments
    await expect(rows).toHaveCount(2)

    // 1. Completed payment — status «Оплачен», no «Зачесть платеж» button
    const completedRow = rows.filter({ hasText: '100' })
    await completedRow.locator('[class*="infoIcon"]').click()
    await expect(modalTitle).toBeVisible()
    await expect(infoTable.getByText('Оплачен')).toBeVisible()
    await expect(infoTable.getByText('Ошибка')).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Зачесть платеж' })).not.toBeVisible()

    // Close the modal
    await page.getByRole('button', { name: 'Закрыть' }).click()
    await expect(modalTitle).not.toBeVisible()

    // 2. Failed payment — status «Ошибка» and the «Зачесть платеж» button is present
    const failedRow = rows.filter({ hasText: '200' })
    await failedRow.locator('[class*="infoIcon"]').click()
    await expect(modalTitle).toBeVisible()
    await expect(infoTable.getByText('Ошибка')).toBeVisible()
    const completeButton = page.getByRole('button', { name: 'Зачесть платеж' })
    await expect(completeButton).toBeVisible()

    // Clicking «Зачесть платеж» shows a confirm dialog — dismissing it changes nothing
    page.once('dialog', (dialog) => dialog.dismiss())
    await completeButton.click()
    await expect(infoTable.getByText('Ошибка')).toBeVisible()
    await expect(completeButton).toBeVisible()

    // Accept the confirm dialog — status changes to «Оплачен» and the button disappears
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toBe(
        'Вы подтверждаете, что платеж действительно поступил на распределительный счет компании?',
      )
      dialog.accept()
    })
    await completeButton.click()
    await expect(infoTable.getByText('Оплачен')).toBeVisible()
    await expect(infoTable.getByText('Ошибка')).not.toBeVisible()
    await expect(completeButton).not.toBeVisible()

    // The table row also reflects the new status
    await expect(rows.filter({ hasText: '200' })).toContainText('Оплачен')
  })
})
