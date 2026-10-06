import { test, expect } from '../../fixtures.js'
import { createTestCompany, createTestUser, createTestOrder, getPrisma } from '../../db.js'

test.describe('admin payments change uid', () => {
  let admin
  let company

  test.beforeEach(async () => {
    company = await createTestCompany('Change UID Company')
    admin = await createTestUser({ firstName: 'Alice', lastName: 'Admin', role: 'Admin', companyId: company.id })
  })

  const openPaymentsTab = async (page) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Платежи' }).click()
    await page.waitForLoadState('networkidle')
  }

  test('changes payment uid: validation error, duplicate error and successful update', async ({ loginAs, page }) => {
    const prisma = getPrisma()

    const candidate = await createTestUser({
      firstName: 'Uid',
      lastName: 'Candidate',
      role: 'Candidate',
      companyId: company.id,
    })

    // Two payments with uids. Default sort (id desc) shows the newer payment
    // (ON-1234-15) first, so that is the one the admin updates.
    const _firstOrder = await createTestOrder(company, candidate, 100, 'Completed', 'ON-1234-01')
    const secondOrder = await createTestOrder(company, candidate, 200, 'Completed', 'ON-1234-15')

    await loginAs(admin.id)
    await openPaymentsTab(page)

    const rows = page.locator('table tbody tr')

    // Admin sees both payments in the list
    await expect(rows).toHaveCount(2)
    await expect(rows.first()).toContainText('ON-1234-15')
    await expect(rows.nth(1)).toContainText('ON-1234-01')

    // Open the first payment's details modal
    const paymentModalTitle = page.getByRole('heading', { name: 'Информация о платеже' })
    await rows.first().locator('[class*="infoIcon"]').click()
    await expect(paymentModalTitle).toBeVisible()

    // The payment modal shows the current uid
    const uidRow = page.getByText('Номер программы:', { exact: true }).locator('..')
    await expect(uidRow).toContainText('ON-1234-15')

    // Open the change-uid modal
    await page.getByRole('button', { name: 'Изменить номер платежа' }).click()
    const changeUidTitle = page.getByRole('heading', { name: 'Изменить номер платежа' })
    await expect(changeUidTitle).toBeVisible()

    const uidInput = page.locator('#uid')
    const saveButton = page.getByRole('button', { name: 'Сохранить' })

    // Default value is the current uid
    await expect(uidInput).toHaveValue('ON-1234-15')

    // 1. Invalid uid -> client-side validation error, modal stays open
    await uidInput.fill('abc')
    await saveButton.click()
    await expect(page.getByText('Введите корректный номер платежа')).toBeVisible()
    await expect(changeUidTitle).toBeVisible()

    // 2. Duplicate uid -> server returns 409, modal stays open
    await uidInput.fill('ON-1234-01')
    await saveButton.click()
    await expect(page.getByText('Такой номер платежа уже есть в системе')).toBeVisible()
    await expect(changeUidTitle).toBeVisible()

    // 3. Valid unique uid -> saved successfully
    await uidInput.fill('ON-1234-03')
    await saveButton.click()

    // ChangeUIDModal closes; payment modal now shows the new uid
    await expect(changeUidTitle).not.toBeVisible()
    await expect(uidRow).toContainText('ON-1234-03')

    // Close the payment modal — the list reflects the new uid
    await page.getByRole('button', { name: 'Закрыть' }).click()
    await expect(paymentModalTitle).not.toBeVisible()
    await expect(rows.first()).toContainText('ON-1234-03')
    await expect(rows.nth(1)).toContainText('ON-1234-01')

    // The database was updated too
    const updated = await prisma.payment.findUnique({ where: { id: secondOrder.payment.id } })
    expect(updated.uid).toBe('ON-1234-03')

    await page.getByTitle('Клиенты').click()
    await page.waitForLoadState('networkidle')
    await page.getByTitle('Платежи').click()
    await expect(page.getByText('ON-1234-03')).toBeVisible()
  })
})
