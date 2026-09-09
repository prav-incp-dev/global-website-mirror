import { test, expect } from '../../fixtures.js'
import { createTestCompany, createTestUser, createTestOrder, getPrisma } from '../../db.js'

test.describe('admin payments refund', () => {
  let admin
  let company

  test.beforeEach(async () => {
    company = await createTestCompany('Payments Refund Company')
    admin = await createTestUser({ firstName: 'Alice', lastName: 'Admin', role: 'Admin', companyId: company.id })
  })

  const openPaymentsTab = async (page) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Платежи' }).click()
    await page.waitForLoadState('networkidle')
  }

  test('refund button only for ToRefund payments; clicking «Зачесть возврат» marks the payment Refunded', async ({
    loginAs,
    page,
  }) => {
    const prisma = getPrisma()

    const candidate = await createTestUser({
      firstName: 'Refund',
      lastName: 'User',
      role: 'Candidate',
      companyId: company.id,
    })

    // Create one completed and one ToRefund payment (amounts are used to identify the rows)
    await createTestOrder(company, candidate, 100, 'Completed')
    const toRefundOrder = await createTestOrder(company, candidate, 200, 'ToRefund')

    await loginAs(admin.id)
    await openPaymentsTab(page)

    const rows = page.locator('table tbody tr')
    const infoTable = page.locator('[class*="infoTable"]')
    const modalTitle = page.getByRole('heading', { name: 'Информация о платеже' })
    const refundButton = page.getByRole('button', { name: 'Зачесть возврат' })

    // Admin sees both payments
    await expect(rows).toHaveCount(2)

    // 1. Completed payment — status «Оплачен», no «Зачесть возврат» button
    const completedRow = rows.filter({ hasText: '100' })
    await completedRow.locator('[class*="infoIcon"]').click()
    await expect(modalTitle).toBeVisible()
    await expect(infoTable.getByText('Оплачен')).toBeVisible()
    await expect(refundButton).not.toBeVisible()

    // Close the modal
    await page.getByRole('button', { name: 'Закрыть' }).click()
    await expect(modalTitle).not.toBeVisible()

    // 2. ToRefund payment — status «Отмена» and the «Зачесть возврат» button is present
    const toRefundRow = rows.filter({ hasText: '200' })
    await toRefundRow.locator('[class*="infoIcon"]').click()
    await expect(modalTitle).toBeVisible()
    await expect(infoTable.getByText('Отмена', { exact: true })).toBeVisible()
    await expect(refundButton).toBeVisible()

    // Clicking «Зачесть возврат» shows a confirm dialog — dismissing it changes nothing
    page.once('dialog', (dialog) => dialog.dismiss())
    await refundButton.click()
    await expect(infoTable.getByText('Отмена', { exact: true })).toBeVisible()
    await expect(refundButton).toBeVisible()

    // Accept the confirm dialog — status changes to «Отменен» and the button disappears
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toBe('Вы подтверждаете, что деньги были возвращены пользователю?')
      dialog.accept()
    })
    await refundButton.click()
    await expect(infoTable.getByText('Отменен')).toBeVisible()
    await expect(infoTable.getByText('Отмена', { exact: true })).not.toBeVisible()
    await expect(refundButton).not.toBeVisible()

    // The table row also reflects the new status
    await expect(rows.filter({ hasText: '200' })).toContainText('Отменен')

    // The database was updated too
    const updated = await prisma.payment.findUnique({ where: { id: toRefundOrder.payment.id } })
    expect(updated.status).toBe('Refunded')
    expect(updated.refundedAt).not.toBeNull()
  })
})
