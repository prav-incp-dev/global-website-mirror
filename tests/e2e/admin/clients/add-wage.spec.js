import { test, expect } from '../../fixtures.js'
import { createTestCompany, createTestUser, getPrisma } from '../../db.js'

test.describe('admin clients add wage', () => {
  let admin
  let company

  // MOCK_ACCOUNT doubles as the company wallet. Must be a valid Ethereum address so
  // getAddress(companyWallet) passes, and must match the stubbed window.ethereum account.
  const MOCK_ACCOUNT = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

  test.beforeEach(async () => {
    company = await createTestCompany('Add Wage Company', { wallet: MOCK_ACCOUNT })
    admin = await createTestUser({ firstName: 'Wage', lastName: 'Admin', role: 'Admin', companyId: company.id })
  })

  const openClientsTab = async (page) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    await page.getByTitle('Клиенты').click()
    await page.waitForLoadState('networkidle')
  }

  const openAddWageModal = async (page, consultant) => {
    // Click the info icon on the consultant's row to open ClientModal
    const consultantRow = page.locator('table tbody tr').filter({ hasText: consultant.firstName })
    await consultantRow.locator('[class*="infoIcon"]').click()
    await expect(page.getByRole('heading', { name: 'Информация о пользователе' })).toBeVisible()

    // Click "Добавить начисление" to open AddWageModal
    await page.getByRole('button', { name: 'Начисления' }).click()
    await page.getByRole('button', { name: 'Добавить начисление' }).click()
    await expect(page.getByRole('heading', { name: 'Добавить начисление' })).toBeVisible()
  }

  test('form validation in AddWageModal', async ({ loginAs, page }) => {
    const consultant = await createTestUser({
      firstName: 'Wage',
      lastName: 'Consultant',
      role: 'Consultant',
      companyId: company.id,
      wallet: '0x1234567890abcdef1234567890abcdef33333333',
    })

    await loginAs(admin.id)
    await openClientsTab(page)
    await openAddWageModal(page, consultant)

    // Both buttons are disabled when form is empty (amount = 0, description = '')
    const transferButton = page.getByRole('button', { name: 'Перевести' })
    const creditButton = page.getByRole('button', { name: 'Зачесть' })
    await expect(transferButton).toBeDisabled()
    await expect(creditButton).toBeDisabled()

    // Negative amount — field error shown
    const amountInput = page.getByLabel('Сумма (USDT)')
    await amountInput.fill('-50')
    await expect(transferButton).toBeDisabled()
    await expect(creditButton).toBeDisabled()

    // Amount > 100000 — field error shown
    await amountInput.fill('999999')
    await expect(transferButton).toBeDisabled()
    await expect(creditButton).toBeDisabled()

    // Zero amount with description selected
    await amountInput.fill('0')
    const descriptionSelect = page.getByLabel('Описание')
    await descriptionSelect.selectOption('Лидерское вознаграждение')
    await expect(page.getByText('Выберите описание')).not.toBeVisible()
    await expect(transferButton).toBeDisabled()
    await expect(creditButton).toBeEnabled()

    // Valid amount with description selected
    await amountInput.fill('500')
    await expect(transferButton).toBeEnabled()
    await expect(creditButton).toBeEnabled()
  })

  test('«Зачесть» creates wage record, shows notification, and closes modal', async ({ loginAs, page }) => {
    const prisma = getPrisma()

    const consultant = await createTestUser({
      firstName: 'Wage',
      lastName: 'Credit',
      role: 'Consultant',
      companyId: company.id,
      wallet: '0x1234567890abcdef1234567890abcdef44444444',
    })

    await loginAs(admin.id)
    await openClientsTab(page)
    await openAddWageModal(page, consultant)

    // Fill the form with valid data
    const amountInput = page.getByLabel('Сумма (USDT)')
    await amountInput.fill('750')

    const descriptionSelect = page.getByLabel('Описание')
    await descriptionSelect.selectOption('На офис')

    // Click "Зачесть"
    const creditButton = page.getByRole('button', { name: 'Зачесть' })
    await expect(creditButton).toBeEnabled()

    // Confirm the dialog
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toBe('Вы подтверждаете, что пользователю было выполнено начисление?')
      dialog.accept()
    })
    await creditButton.click()

    // The AddWageModal closes and the success notification appears in ClientModal
    await expect(page.getByRole('heading', { name: 'Добавить начисление' })).not.toBeVisible()

    // The wage was created in the database
    const wages = await prisma.wage.findMany({
      where: { userId: consultant.id, description: 'На офис' },
    })
    expect(wages.length).toBe(1)
    expect(Number(wages[0].amount)).toBe(750)
    expect(wages[0].description).toBe('На офис')
  })

  test('«Перевести» with rejected wallet shows error', async ({ loginAs, page }) => {
    const prisma = getPrisma()

    const consultant = await createTestUser({
      firstName: 'Wage',
      lastName: 'Transfer',
      role: 'Consultant',
      companyId: company.id,
      wallet: '0x1234567890abcdef1234567890abcdef55555555',
    })

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
    await openClientsTab(page)
    await openAddWageModal(page, consultant)

    // Fill the form with valid data
    const amountInput = page.getByLabel('Сумма (USDT)')
    await amountInput.fill('250')

    const descriptionSelect = page.getByLabel('Описание')
    await descriptionSelect.selectOption('На путешествие')

    // Click "Перевести"
    const transferButton = page.getByRole('button', { name: 'Перевести' })
    await expect(transferButton).toBeEnabled()
    await transferButton.click()

    // The rejected wallet error appears in the modal
    await expect(page.getByRole('heading', { name: 'Добавить начисление' })).toBeVisible()
    await expect(page.getByText('Ошибка сети: User rejected the request.')).toBeVisible({ timeout: 10000 })

    // No wage was created in the database
    const wages = await prisma.wage.findMany({
      where: { userId: consultant.id, description: 'На путешествие' },
    })
    expect(wages.length).toBe(0)

    // Close the modal
    const closeButtons = page.getByRole('button', { name: 'Закрыть' })
    await closeButtons.last().click()
    await expect(page.getByRole('heading', { name: 'Добавить начисление' })).not.toBeVisible()
  })

  test('wages are reflected on the Начисления tab, newest first', async ({ loginAs, page }) => {
    const prisma = getPrisma()

    const consultant = await createTestUser({
      firstName: 'Wage',
      lastName: 'Reflect',
      role: 'Consultant',
      companyId: company.id,
      wallet: '0x1234567890abcdef1234567890abcdef66666666',
    })

    // Seed two wages directly in the DB with staggered createdAt values
    await prisma.wage.create({
      data: {
        companyId: company.id,
        userId: consultant.id,
        amount: 100,
        description: 'Лидерское вознаграждение',
        score: 0,
        groupScore: 0,
        createdAt: new Date(Date.now() - 2 * 60 * 1000),
      },
    })
    await prisma.wage.create({
      data: {
        companyId: company.id,
        userId: consultant.id,
        amount: 250,
        description: 'На офис',
        score: 0,
        groupScore: 0,
        createdAt: new Date(Date.now() - 60 * 1000),
      },
    })

    await loginAs(admin.id)
    await openClientsTab(page)

    // Open the ClientModal for the consultant
    const consultantRow = page.locator('table tbody tr').filter({ hasText: consultant.firstName })
    await consultantRow.locator('[class*="infoIcon"]').click()
    await expect(page.getByRole('heading', { name: 'Информация о пользователе' })).toBeVisible()

    // Open the Начисления tab
    await page.getByRole('button', { name: 'Начисления' }).click()

    // Both wages are shown, newest first (250 then 100)
    const wageRows = page.locator('[class*="wageRecord"]')
    await expect(wageRows).toHaveCount(2)
    await expect(wageRows.first()).toContainText('$250.00 USDT')
    await expect(wageRows.first()).toContainText('На офис')
    await expect(wageRows.nth(1)).toContainText('$100.00 USDT')
    await expect(wageRows.nth(1)).toContainText('Лидерское вознаграждение')

    // Open AddWageModal
    await page.getByRole('button', { name: 'Добавить начисление' }).click()
    await expect(page.getByRole('heading', { name: 'Добавить начисление' })).toBeVisible()

    // Fill the form with amount 75 and description 'На путешествие'
    const amountInput = page.getByLabel('Сумма (USDT)')
    await amountInput.fill('75')
    const descriptionSelect = page.getByLabel('Описание')
    await descriptionSelect.selectOption('На путешествие')

    // Click "Зачесть"
    const creditButton = page.getByRole('button', { name: 'Зачесть' })
    await expect(creditButton).toBeEnabled()

    // Confirm the dialog
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toBe('Вы подтверждаете, что пользователю было выполнено начисление?')
      dialog.accept()
    })
    await creditButton.click()

    // The AddWageModal closes and the success notification appears
    await expect(page.getByRole('heading', { name: 'Добавить начисление' })).not.toBeVisible()
    // The new record appears at the top of the wages list (newest first): 75, then 250, then 100
    await expect(wageRows).toHaveCount(3)
    await expect(wageRows.first()).toContainText('$75.00 USDT')
    await expect(wageRows.first()).toContainText('На путешествие')
    await expect(wageRows.nth(1)).toContainText('$250.00 USDT')
    await expect(wageRows.nth(1)).toContainText('На офис')
    await expect(wageRows.nth(2)).toContainText('$100.00 USDT')
    await expect(wageRows.nth(2)).toContainText('Лидерское вознаграждение')
  })
})
