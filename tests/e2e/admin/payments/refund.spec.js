import { test, expect } from '../../fixtures.js'
import { createTestCompany, createTestUser, createTestOrder, getPrisma } from '../../db.js'

test.describe('admin payments refund', () => {
  let admin
  let company

  // MOCK_ACCOUNT doubles as the company wallet. Must be a valid Ethereum address so
  // getAddress(companyWallet) passes, and must match the stubbed window.ethereum account.
  const MOCK_ACCOUNT = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

  test.beforeEach(async () => {
    company = await createTestCompany('Payments Refund Company', { wallet: MOCK_ACCOUNT })
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

  test('«Выполнить возврат» opens RefundModal with wallet and refund amount', async ({ loginAs, page }) => {
    // Candidate wallet must be a valid Ethereum address so getAddress(fromWallet) passes
    const candidate = await createTestUser({
      firstName: 'Refund',
      lastName: 'Modal',
      role: 'Candidate',
      companyId: company.id,
      wallet: '0x1234567890abcdef1234567890abcdef22222222',
    })

    const toRefundOrder = await createTestOrder(company, candidate, 200, 'ToRefund')

    // Stub window.ethereum BEFORE loginAs navigates to the page
    await page.addInitScript(
      ({ account }) => {
        window.ethereum = {
          isMetaMask: true,
          request: async ({ method }) => {
            switch (method) {
              case 'eth_requestAccounts':
              case 'eth_accounts':
                return [account]
              case 'eth_chainId':
                return '0x61'
              case 'wallet_switchEthereumChain':
                return null
              case 'eth_sendTransaction':
                // code 4001 → viem produces shortMessage 'User rejected the request.'
                throw Object.assign(new Error('User denied'), { code: 4001 })
              default:
                return null
            }
          },
          on: () => {},
          removeListener: () => {},
        }
      },
      { account: MOCK_ACCOUNT },
    )

    await loginAs(admin.id)
    await openPaymentsTab(page)

    const rows = page.locator('table tbody tr')
    const toRefundRow = rows.filter({ hasText: '200' })
    await toRefundRow.locator('[class*="infoIcon"]').click()

    // The modal shows the «Выполнить возврат» button for ToRefund payments
    const executeRefundButton = page.getByRole('button', { name: 'Выполнить возврат' })
    await expect(executeRefundButton).toBeVisible()

    // Clicking it opens the RefundModal
    await executeRefundButton.click()

    const refundModalTitle = page.getByRole('heading', { name: 'Выполнить возврат' })
    await expect(refundModalTitle).toBeVisible()

    // The modal shows the from wallet and the amount minus the refund fee (200 − 5% = 190)
    await expect(page.getByText(`Деньги будут отправлены на счет`)).toBeVisible()
    await expect(page.getByText('Сумма к отправке: $190.00')).toBeVisible()

    // The «Оплатить» button is present
    const payButton = page.getByRole('button', { name: 'Оплатить' })
    await expect(payButton).toBeVisible()

    // Click «Оплатить» — the stubbed wallet rejects the transaction (code 4001).
    // No txHash was created, so the generic error message is shown.
    await payButton.click()
    await expect(page.getByText('Ошибка сети: User rejected the request.')).toBeVisible()

    // The RefundModal can be closed
    const closeButtons = page.getByRole('button', { name: 'Закрыть' })
    await closeButtons.last().click()
    await expect(refundModalTitle).not.toBeVisible()

    // The payment is unchanged
    const unchanged = await getPrisma().payment.findUnique({ where: { id: toRefundOrder.payment.id } })
    expect(unchanged.status).toBe('ToRefund')
  })
})
