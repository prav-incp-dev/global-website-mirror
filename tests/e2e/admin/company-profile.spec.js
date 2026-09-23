import { test, expect } from '../fixtures.js'
import { createTestCompany, createTestUser, getPrisma } from '../db.js'
import fs from 'fs'
import path from 'path'

test.describe('admin manages company profile', () => {
  let admin

  test.beforeEach(async () => {
    const company = await createTestCompany('Admin Company Profile')
    admin = await createTestUser({ firstName: 'Alice', lastName: 'Admin', role: 'Admin', companyId: company.id })
  })

  const navigateToCompanyTab = async (page) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Профиль компании' }).click()
  }

  test('updates company data successfully', async ({ loginAs, page }) => {
    await loginAs(admin.id)
    await navigateToCompanyTab(page)
    await page.getByRole('button', { name: 'Редактировать' }).click()

    // Update all fields
    await page.locator('#name').fill('Updated Company Name')
    await page.locator('#wallet').fill('0x1234567890abcdef1234567890abcdef12345678')
    await page.locator('#serviceWallet').fill('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    await page.locator('#cumulativeWallet').fill('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
    await page.getByRole('button', { name: 'Сохранить' }).click()

    // Verify view mode shows updated data
    await expect(page.getByText('Updated Company Name')).toBeVisible()
    await expect(page.getByText('0x12345678...12345678')).toBeVisible()
    await expect(page.getByText('0xaaaaaaaa...aaaaaaaa')).toBeVisible()
    await expect(page.getByText('0xbbbbbbbb...bbbbbbbb')).toBeVisible()

    // Clear all wallet fields
    await page.getByRole('button', { name: 'Редактировать' }).click()
    await page.locator('#wallet').fill('')
    await page.locator('#serviceWallet').fill('')
    await page.locator('#cumulativeWallet').fill('')
    await page.getByRole('button', { name: 'Сохранить' }).click()
    await expect(page.getByText('—')).toHaveCount(3)

    await page.getByRole('button', { name: 'Профиль администратора' }).click()
    await page.getByRole('button', { name: 'Профиль компании' }).click()
    await expect(page.getByText('Updated Company Name')).toBeVisible()
  })

  test('shows validation error for invalid serviceWallet', async ({ loginAs, page }) => {
    await loginAs(admin.id)
    await navigateToCompanyTab(page)
    await page.getByRole('button', { name: 'Редактировать' }).click()

    await page.locator('#serviceWallet').fill('invalid-wallet-format')
    await page.getByRole('button', { name: 'Сохранить' }).click()

    await expect(page.getByText('Неверный формат кошелька')).toHaveCount(1)
  })

  test('shows validation error for invalid cumulativeWallet', async ({ loginAs, page }) => {
    await loginAs(admin.id)
    await navigateToCompanyTab(page)
    await page.getByRole('button', { name: 'Редактировать' }).click()

    await page.locator('#cumulativeWallet').fill('bad-wallet')
    await page.getByRole('button', { name: 'Сохранить' }).click()

    await expect(page.getByText('Неверный формат кошелька')).toHaveCount(1)
  })

  test('shows validation error for invalid wallet', async ({ loginAs, page }) => {
    await loginAs(admin.id)
    await navigateToCompanyTab(page)
    await page.getByRole('button', { name: 'Редактировать' }).click()

    await page.locator('#wallet').fill('invalid-wallet-format')
    await page.getByRole('button', { name: 'Сохранить' }).click()

    // Client-side validation from react-hook-form pattern
    await expect(page.getByText('Неверный формат кошелька')).toHaveCount(1)
  })

  test('shows error when company name is already taken', async ({ loginAs, page }) => {
    // Create another company with a different name via Prisma directly
    await createTestCompany('Existing Company')

    await loginAs(admin.id)
    await navigateToCompanyTab(page)
    await page.getByRole('button', { name: 'Редактировать' }).click()

    // Try to rename to the existing company name
    await page.locator('#name').fill('Existing Company')
    await page.getByRole('button', { name: 'Сохранить' }).click()

    // Server-side validation error
    await expect(page.getByText('Такое имя компании уже есть в системе')).toBeVisible()
  })

  test('shows error when service wallet is already taken', async ({ loginAs, page }) => {
    const walletAddress = '0x1234567890abcdef1234567890abcdef12345678'
    // Create another company with a different name via Prisma directly
    await createTestCompany('Existing Company', { serviceWallet: walletAddress })

    await loginAs(admin.id)
    await navigateToCompanyTab(page)
    await page.getByRole('button', { name: 'Редактировать' }).click()

    // Try to rename to the existing company name
    await page.locator('#serviceWallet').fill(walletAddress)
    await page.getByRole('button', { name: 'Сохранить' }).click()

    // Server-side validation error
    await expect(page.getByText('Такой счет на обслуживание уже есть в системе')).toBeVisible()
  })
})

test.describe('admin company wages export', () => {
  test('exports wages csv for service wallet', async ({ loginAs, page }) => {
    const prisma = getPrisma()

    const SERVICE_WALLET = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const CUMULATIVE_WALLET = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    const company = await createTestCompany('Wages Export Company', {
      wallet: '0xcccccccccccccccccccccccccccccccccccccccc',
      serviceWallet: SERVICE_WALLET,
      cumulativeWallet: CUMULATIVE_WALLET,
    })

    const adminUser = await createTestUser({
      firstName: 'Wages',
      lastName: 'Admin',
      role: 'Admin',
      companyId: company.id,
    })
    const consultant = await createTestUser({
      firstName: 'Wage',
      lastName: 'Consultant',
      role: 'Consultant',
      companyId: company.id,
    })

    const order = await prisma.order.create({
      data: { userId: consultant.id, quantity: 1, totalAmount: 500, status: 'Paid' },
    })

    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        userId: consultant.id,
        companyId: company.id,
        amount: 500,
        tokenSymbol: 'USDT',
        tokenContract: '0xTokenContract',
        tokenDecimals: 18,
        chainId: 56,
        txHash: '0xTESTTXHASH1234567890abcdef1234567890abcdef',
        fromWallet: consultant.wallet,
        toWallet: company.wallet,
        status: 'Completed',
      },
    })

    await prisma.wage.create({
      data: {
        companyId: company.id,
        userId: null,
        paymentId: payment.id,
        fromWallet: consultant.wallet,
        toWallet: SERVICE_WALLET,
        amount: 100,
        score: 0,
        groupScore: 0,
        createdAt: new Date('2025-06-15T10:00:00Z'),
      },
    })

    await prisma.wage.create({
      data: {
        companyId: company.id,
        userId: null,
        paymentId: payment.id,
        fromWallet: consultant.wallet,
        toWallet: SERVICE_WALLET,
        amount: 250.5,
        score: 0,
        groupScore: 0,
        description: 'Service fee',
        createdAt: new Date('2025-07-20T10:00:00Z'),
      },
    })

    await loginAs(adminUser.id)
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Профиль компании' }).click()
    await page.waitForLoadState('networkidle')

    const serviceDownloadButton = page.locator('[title="Выгрузить начисления"]').first()
    await expect(serviceDownloadButton).toBeVisible()
    await serviceDownloadButton.click()

    const modalTitle = page.getByRole('heading', { name: 'Выгрузка начислений на сервисный счет' })
    await expect(modalTitle).toBeVisible()

    await expect(page.getByLabel('С', { exact: true })).toBeVisible()
    await expect(page.getByLabel('По', { exact: true })).toBeVisible()
    const confirmButton = page.getByRole('button', { name: 'Сформировать' })
    await expect(confirmButton).toBeVisible()
    await expect(confirmButton).toBeEnabled()

    await page.getByLabel('С', { exact: true }).fill('2025-01-01')
    await page.getByLabel('По', { exact: true }).fill('2025-12-31')

    const downloadPromise = page.waitForEvent('download')
    await confirmButton.click()

    const download = await downloadPromise
    const fileName = download.suggestedFilename()
    expect(fileName).toMatch(/^wages-.+\.csv$/)

    const tempPath = path.join('tests/fixtures', fileName)
    await download.saveAs(tempPath)

    expect(fs.existsSync(tempPath)).toBeTruthy()
    const fileStats = fs.statSync(tempPath)
    expect(fileStats.size).toBeGreaterThan(0)

    const fileContent = fs.readFileSync(tempPath, 'utf-8')
    expect(fileContent.startsWith('\uFEFF')).toBeTruthy()

    const csvLines = fileContent.replace('\uFEFF', '').split('\n').filter(Boolean)

    expect(csvLines[0]).toBe('Дата,Сумма,Пользователь,Кошелек отправителя,Хэш транзакции')

    const wage100Line = csvLines.find((l) => l.includes('100.00'))
    expect(wage100Line).toBeTruthy()
    expect(wage100Line).toContain(consultant.wallet)
    expect(wage100Line).toContain('0xTESTTXHASH1234567890abcdef1234567890abcdef')

    const wage250Line = csvLines.find((l) => l.includes('250.50'))
    expect(wage250Line).toBeTruthy()
    expect(wage250Line).toContain('Wage Consultant')
    expect(wage250Line).toContain(consultant.wallet)

    fs.unlinkSync(tempPath)

    await expect(modalTitle).not.toBeVisible()
  })
})
