import { test, expect } from '../../fixtures.js'
import { createTestCompany, createTestUser, createTestOrder } from '../../db.js'

test.describe('admin payments filters and details', () => {
  let admin
  let company

  test.beforeEach(async () => {
    company = await createTestCompany('Payments Filters Company')
    admin = await createTestUser({ firstName: 'Alice', lastName: 'Admin', role: 'Admin', companyId: company.id })
  })

  const openPaymentsTab = async (page) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Платежи' }).click()
    await page.waitForLoadState('networkidle')
  }

  const paymentAmounts = async (rows) => {
    return rows.locator('td:first-child').allTextContents()
  }

  test('searches payments and shows payment details in modal', async ({ loginAs, page }) => {
    const vlad = await createTestUser({ firstName: 'Vlad', lastName: 'Voronin', role: 'Candidate', companyId: company.id })
    const ivan = await createTestUser({ firstName: 'Ivan', lastName: 'Petrov', role: 'Candidate', companyId: company.id })

    await createTestOrder(company, vlad, 111, 'Completed')
    await createTestOrder(company, ivan, 222, 'Completed')
    await createTestOrder(company, vlad, 333, 'ToRefund')
    const order444 = await createTestOrder(company, ivan, 444, 'Pending')

    await loginAs(admin.id)
    await openPaymentsTab(page)

    const rows = page.locator('table tbody tr')

    // Initial state — all 4 payments visible
    await expect(rows).toHaveCount(4)

    // Search by candidate first name — only Vlad's payments remain (333, 111 by id desc)
    const searchInput = page.locator('input[placeholder="Поиск"]')
    await searchInput.fill('Vlad')
    await expect(rows).toHaveCount(2)
    await expect(rows.first()).toContainText('333')
    await expect(rows.nth(1)).toContainText('111')

    // Search by txHash fragment — only the matching payment remains
    await searchInput.fill(order444.payment.txHash.slice(0, 20))
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('444')
    await expect(rows.first()).toContainText('В обработке')

    // Clear search — all 4 payments back
    await searchInput.fill('')
    await expect(rows).toHaveCount(4)

    // Open payment details modal for the newest payment (444 / Pending / Ivan Petrov)
    await rows.first().locator('[class*="infoIcon"]').click()
    const modalTitle = page.getByRole('heading', { name: 'Информация о платеже' })
    await expect(modalTitle).toBeVisible()

    const infoTable = page.locator('[class*="infoTable"]')
    await expect(infoTable.getByText('Сумма:')).toBeVisible()
    await expect(infoTable.getByText('444', { exact: true })).toBeVisible()
    await expect(infoTable.getByText('UID:')).toBeVisible()
    await expect(infoTable.getByText('Статус:')).toBeVisible()
    await expect(infoTable.getByText('В обработке')).toBeVisible()
    await expect(infoTable.getByText('Дата:')).toBeVisible()
    await expect(infoTable.getByText('txHash:')).toBeVisible()
    await expect(infoTable.getByText(order444.payment.txHash)).toBeVisible()
    await expect(infoTable.getByText('Пользователь:')).toBeVisible()
    await expect(infoTable.getByText('Ivan Petrov')).toBeVisible()

    // Close the modal
    await page.getByRole('button', { name: 'Закрыть' }).click()
    await expect(modalTitle).not.toBeVisible()
  })

  test('applies Отмена filter and ordering options', async ({ loginAs, page }) => {
    const candidate = await createTestUser({
      firstName: 'Order',
      lastName: 'User',
      role: 'Candidate',
      companyId: company.id,
    })

    // Payments created in order 400, 100, 300, 200 — default sort (id desc) shows 200, 300, 100, 400
    await createTestOrder(company, candidate, 400, 'Pending')
    await createTestOrder(company, candidate, 100, 'Completed')
    await createTestOrder(company, candidate, 300, 'ToRefund')
    await createTestOrder(company, candidate, 200, 'Failed')

    await loginAs(admin.id)
    await openPaymentsTab(page)

    const rows = page.locator('table tbody tr')

    // 1. Default order (id descending)
    await expect(rows).toHaveCount(4)
    expect(await paymentAmounts(rows)).toEqual(['200', '300', '100', '400'])

    // 2. Filter by 'Отмена' (toRefundOnly) — only the ToRefund payment remains
    const refundToggle = page.getByRole('button', { name: 'Отмена (1)' })
    await refundToggle.click()
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('300')
    await expect(rows.first()).toContainText('Отмена')

    // Toggle off — all 4 payments back
    await page.getByRole('button', { name: 'Отмена (1)' }).click()
    await expect(rows).toHaveCount(4)

    // 3. Sort by amount (ascending)
    await page.getByTitle('Сортировка').click()
    await page.getByText('По сумме').click()
    await expect(rows.first()).toContainText('100')
    expect(await paymentAmounts(rows)).toEqual(['100', '200', '300', '400'])

    // 4. Sort by status (ascending: Pending, Completed, ToRefund, Failed)
    await page.getByTitle('Сортировка').click()
    await page.getByText('По статусу').click()
    await expect(rows.first()).toContainText('400')
    expect(await paymentAmounts(rows)).toEqual(['400', '100', '300', '200'])

    // 5. Back to default order (id descending)
    await page.getByTitle('Сортировка').click()
    await page.getByText('По умолчанию').click()
    await expect(rows.first()).toContainText('200')
    expect(await paymentAmounts(rows)).toEqual(['200', '300', '100', '400'])
  })
})
