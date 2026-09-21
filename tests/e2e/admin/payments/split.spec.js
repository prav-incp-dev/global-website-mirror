import { test, expect } from '../../fixtures.js'
import { createTestCompany, createTestUser, createTestOrder, getPrisma } from '../../db.js'
import { walletPreview } from '@/lib/wallet'

test.describe('admin payments split', () => {
  let admin
  let company

  // MOCK_ACCOUNT doubles as the company wallet. Must be a valid Ethereum address so
  // getAddress(companyWallet) passes, and must match the stubbed window.ethereum account.
  const MOCK_ACCOUNT = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  const MOCK_SERVICE_WALLET = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
  const MOCK_CUMULATIVE_WALLET = '0xcccccccccccccccccccccccccccccccccccccccc'

  test.beforeEach(async () => {
    company = await createTestCompany('Payments Split Company', {
      wallet: MOCK_ACCOUNT,
      serviceWallet: MOCK_SERVICE_WALLET,
      cumulativeWallet: MOCK_CUMULATIVE_WALLET,
    })
    admin = await createTestUser({ firstName: 'Split', lastName: 'Admin', role: 'Admin', companyId: company.id })
  })

  const openPaymentsTab = async (page) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Платежи' }).click()
    await page.waitForLoadState('networkidle')
  }
  test('split buttons visible only for completed and finalized payments', async ({ loginAs, page }) => {
    const prisma = getPrisma()

    const candidate = await createTestUser({
      firstName: 'Split',
      lastName: 'Candidate',
      role: 'Candidate',
      companyId: company.id,
    })

    // Create three payments with different statuses (amounts identify rows)
    // 1. Completed + finalized
    const finalizedOrder = await createTestOrder(company, candidate, 100, 'Completed', 'ON-1000-01')
    await prisma.payment.update({ where: { id: finalizedOrder.payment.id }, data: { finalized: true } })

    // 2. Completed but not finalized
    await createTestOrder(company, candidate, 200, 'Completed', 'ON-2000-01')

    // 3. Already splitted
    const splittedOrder = await createTestOrder(company, candidate, 300, 'Splitted', 'ON-3000-01')
    await prisma.payment.update({ where: { id: splittedOrder.payment.id }, data: { finalized: true } })

    await loginAs(admin.id)
    await openPaymentsTab(page)

    const rows = page.locator('table tbody tr')
    const modalTitle = page.getByRole('heading', { name: 'Информация о платеже' })
    const splitButton = page.getByRole('button', { name: 'Распределить платеж' })
    const confirmSplitButton = page.getByRole('button', { name: 'Зачесть распределение платежа' })

    // Admin sees all three payments
    await expect(rows).toHaveCount(3)

    // 1. Completed + finalized payment — both buttons visible
    const finalizedRow = rows.filter({ hasText: '100' })
    await finalizedRow.locator('[class*="infoIcon"]').click()
    await expect(modalTitle).toBeVisible()
    await expect(splitButton).toBeVisible()
    await expect(confirmSplitButton).toBeVisible()

    await page.getByRole('button', { name: 'Закрыть' }).click()
    await expect(modalTitle).not.toBeVisible()

    // 2. Completed but not finalized — neither button visible
    const nonFinalizedRow = rows.filter({ hasText: '200' })
    await nonFinalizedRow.locator('[class*="infoIcon"]').click()
    await expect(modalTitle).toBeVisible()
    await expect(splitButton).not.toBeVisible()
    await expect(confirmSplitButton).not.toBeVisible()

    await page.getByRole('button', { name: 'Закрыть' }).click()
    await expect(modalTitle).not.toBeVisible()

    // 3. Already splitted — neither button visible
    const splittedRow = rows.filter({ hasText: '300' })
    await splittedRow.locator('[class*="infoIcon"]').click()
    await expect(modalTitle).toBeVisible()
    await expect(splitButton).not.toBeVisible()
    await expect(confirmSplitButton).not.toBeVisible()

    await page.getByRole('button', { name: 'Закрыть' }).click()
    await expect(modalTitle).not.toBeVisible()
  })

  test('«Зачесть распределение платежа» calculates split, creates wages, and marks payment Splitted', async ({
    loginAs,
    page,
  }) => {
    const prisma = getPrisma()

    // Create a parent-child chain so calculate-split returns ancestor wallets
    const parent = await createTestUser({
      firstName: 'Split',
      lastName: 'Parent',
      role: 'Consultant',
      companyId: company.id,
      level: 2,
      wallet: '0xdddddddddddddddddddddddddddddddddddddddd',
    })
    const candidate = await createTestUser({
      firstName: 'Split',
      lastName: 'Child',
      role: 'Candidate',
      companyId: company.id,
      parentId: parent.id,
      level: 1,
    })

    const completedOrder = await createTestOrder(company, candidate, 1200, 'Completed', 'ON-4000-01')
    const payment = completedOrder.payment
    await prisma.payment.update({ where: { id: payment.id }, data: { finalized: true } })

    await loginAs(admin.id)
    await openPaymentsTab(page)

    const rows = page.locator('table tbody tr')
    const modalTitle = page.getByRole('heading', { name: 'Информация о платеже' })
    const confirmSplitButton = page.getByRole('button', { name: 'Зачесть распределение платежа' })

    // Open payment modal
    const paymentRow = rows.filter({ hasText: '1200' })
    await paymentRow.locator('[class*="infoIcon"]').click()
    await expect(modalTitle).toBeVisible()
    await expect(confirmSplitButton).toBeVisible()

    // Dismiss the confirm dialog — nothing changes
    page.once('dialog', (dialog) => dialog.dismiss())
    await confirmSplitButton.click()
    await expect(confirmSplitButton).toBeVisible()

    // Accept the confirm dialog — this triggers handleManualSplit
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toBe(
        'Вы подтверждаете, что платеж действительно был распределен по корпоративным счетам и структуре?',
      )
      dialog.accept()
    })
    await confirmSplitButton.click()

    // Wait for the success alert and accept it
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toBe('Распределение платежа успешно зачтено!')
      dialog.accept()
    })

    // Status changed to «Распределен» and buttons are gone
    await expect(page.locator('[class*="infoTable"]').getByText('Распределен')).toBeVisible({ timeout: 10000 })
    await expect(confirmSplitButton).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Распределить платеж' })).not.toBeVisible()

    // The table row reflects the new status
    await expect(rows.filter({ hasText: '1200' })).toContainText('Распределен')

    // The database was updated
    const updated = await prisma.payment.findUnique({ where: { id: payment.id } })
    expect(updated.status).toBe('Splitted')

    // Wage records were created for serviceWallet, ancestor wallet, and cumulativeWallet
    const wages = await prisma.wage.findMany({
      where: { paymentId: payment.id },
      orderBy: { id: 'asc' },
    })
    expect(wages.length).toBeGreaterThanOrEqual(3)

    const serviceWage = wages.find((w) => w.toWallet === MOCK_SERVICE_WALLET)
    expect(serviceWage).toBeTruthy()
    expect(serviceWage.userId).toBeNull()
    expect(Number(serviceWage.amount)).toBeGreaterThan(0)

    const cumulativeWage = wages.find((w) => w.toWallet === MOCK_CUMULATIVE_WALLET)
    expect(cumulativeWage).toBeTruthy()
    expect(cumulativeWage.userId).toBeNull()
    expect(Number(cumulativeWage.amount)).toBeGreaterThan(0)

    // Parent has a wallet so a wage should exist for them
    const ancestorWage = wages.find((w) => w.toWallet === '0xdddddddddddddddddddddddddddddddddddddddd')
    expect(ancestorWage).toBeTruthy()
    expect(ancestorWage.userId).toBe(parent.id)
  })


  test('«Распределить платеж» opens SplitPaymentModal with calculated split and handles wallet rejection', async ({
    loginAs,
    page,
  }) => {
    const prisma = getPrisma()

    // Create a parent so calculate-split returns ancestor wallet
    const parent = await createTestUser({
      firstName: 'Split',
      lastName: 'Parent2',
      role: 'Consultant',
      companyId: company.id,
      level: 2,
      wallet: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    })
    const candidate = await createTestUser({
      firstName: 'Split',
      lastName: 'Child2',
      role: 'Candidate',
      companyId: company.id,
      parentId: parent.id,
      level: 1,
    })

    const completedOrder = await createTestOrder(company, candidate, 1200, 'Completed', 'ON-5000-01')
    const payment = completedOrder.payment
    await prisma.payment.update({ where: { id: payment.id }, data: { finalized: true } })

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
    const modalTitle = page.getByRole('heading', { name: 'Информация о платеже' })
    const splitButton = page.getByRole('button', { name: 'Распределить платеж' })

    // Open payment modal and click the split button
    const paymentRow = rows.filter({ hasText: '1200' })
    await paymentRow.locator('[class*="infoIcon"]').click()
    await expect(modalTitle).toBeVisible()
    await expect(splitButton).toBeVisible()

    await splitButton.click()

    // The SplitPaymentModal opens with the list of addresses
    const splitModalTitle = page.getByRole('heading', { name: 'Распределение платежа' })
    await expect(splitModalTitle).toBeVisible()

    // The modal shows the split amounts
    await expect(page.getByText('Платеж будет распределен по следующим адресам:')).toBeVisible()

    // The split list shows exact amounts paired with wallet previews
    const splitRows = page.locator('[class*="splitRow"]')

    // $12.00 → 0xbbbbbbbb...bbbbbbbb (company serviceWallet)
    const serviceRow = splitRows.filter({ hasText: '$12.00' })
    await expect(serviceRow).toContainText(walletPreview(MOCK_SERVICE_WALLET))

    // $360.00 → 0xeeeeeeee...eeeeeeee (parent wallet)
    const userRow = splitRows.filter({ hasText: '$360.00' })
    await expect(userRow).toContainText(walletPreview('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'))

    // $828.00 → 0xcccccccc...cccccccc (cumulative wallet)
    const cumulativeRow = splitRows.filter({ hasText: '$828.00' })
    await expect(cumulativeRow).toContainText(walletPreview(MOCK_CUMULATIVE_WALLET))

    // The confirm button is present
    const confirmButton = page.getByRole('button', { name: 'Подтвердить' })
    await expect(confirmButton).toBeVisible()

    // The stubbed wallet rejects the transaction (code 4001).
    // The error message appears in the split modal.
    await confirmButton.click()

    await expect(splitModalTitle).toBeVisible()
    await expect(page.getByText('User rejected the request.')).toBeVisible({ timeout: 10000 })

    // Close the split modal
    const closeButtons = page.getByRole('button', { name: 'Закрыть' })
    const splitCloseButton = closeButtons.last()
    await splitCloseButton.click()
    await expect(splitModalTitle).not.toBeVisible()

    // The payment is unchanged
    const unchanged = await prisma.payment.findUnique({ where: { id: payment.id } })
    expect(unchanged.status).toBe('Completed')
  })
})

