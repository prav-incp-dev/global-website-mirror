import { test, expect } from '../../fixtures.js'
import { createTestCompany, createTestUser, createTestOrder, getPrisma } from '../../db.js'
import { userName } from '../../../../src/lib/user.js'

test.describe('admin clients delete user', () => {
  let admin
  let company

  test.beforeEach(async () => {
    company = await createTestCompany('Delete User Company')
    admin = await createTestUser({
      firstName: 'Delete',
      lastName: 'Admin',
      role: 'Admin',
      companyId: company.id,
    })
  })

  const openClientsTab = async (page) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    await page.getByTitle('Клиенты').click()
    await page.waitForLoadState('networkidle')
  }

  const openUserModal = async (page, user) => {
    const row = page.locator('table tbody tr').filter({ hasText: user.firstName })
    await row.locator('[class*="infoIcon"]').click()
    await expect(page.getByRole('heading', { name: 'Информация о пользователе' })).toBeVisible()
  }

  const closeUserModal = async (page) => {
    const closeButtons = page.getByRole('button', { name: 'Закрыть' })
    await closeButtons.first().click()
    await expect(page.getByRole('heading', { name: 'Информация о пользователе' })).not.toBeVisible()
  }

  const confirmDelete = (page, dialogMessage) => {
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toBe(dialogMessage)
      dialog.accept()
    })
  }

  test('delete is only for candidates; payment blocks deletion and clean candidate is removed', async ({
    loginAs,
    page,
  }) => {
    const prisma = getPrisma()

    const consultant = await createTestUser({
      firstName: 'DelCon',
      lastName: 'Consultant',
      role: 'Consultant',
      companyId: company.id,
    })

    const candidateWithPayment = await createTestUser({
      firstName: 'DelPay',
      lastName: 'Candidate',
      role: 'Candidate',
      companyId: company.id,
    })

    const candidateClean = await createTestUser({
      firstName: 'DelClean',
      lastName: 'Candidate',
      role: 'Candidate',
      companyId: company.id,
    })

    // Give the middle candidate a single payment (creates an Order + Payment too)
    await createTestOrder(company, candidateWithPayment, 100, 'Completed')

    await loginAs(admin.id)
    await openClientsTab(page)

    // 1. Consultant — no delete button available
    await openUserModal(page, consultant)
    await expect(page.getByRole('button', { name: 'Удалить пользователя' })).not.toBeVisible()
    await closeUserModal(page)

    // 2. Candidate with a payment — delete attempt shows an error and user stays
    await openUserModal(page, candidateWithPayment)
    const deleteButton = page.getByRole('button', { name: 'Удалить пользователя' })
    await expect(deleteButton).toBeVisible()
    confirmDelete(page, 'Вы уверены, что хотите удалить пользователя? Действие необратимо.')
    await deleteButton.click()
    await expect(page.getByText('Ошибка удаления пользователя')).toBeVisible()
    await expect(page.locator('table tbody tr').filter({ hasText: candidateWithPayment.firstName })).toHaveCount(1)
    await closeUserModal(page)

    // 3. Candidate with no references — delete succeeds and user disappears from the list
    await openUserModal(page, candidateClean)
    const cleanDeleteButton = page.getByRole('button', { name: 'Удалить пользователя' })
    await expect(cleanDeleteButton).toBeVisible()
    confirmDelete(page, 'Вы уверены, что хотите удалить пользователя? Действие необратимо.')
    await cleanDeleteButton.click()

    await expect(page.getByText(userName(candidateClean))).not.toBeVisible()
    await expect(page.getByText(userName(consultant))).toBeVisible()
    await expect(page.getByText(userName(candidateWithPayment))).toBeVisible()

    // 4. Navigate to payments tab and back - deleted user stays absent (context persisted)
    await page.getByTitle("Платежи").click()
    await page.waitForLoadState("networkidle")
    await page.getByTitle("Клиенты").click()
    await expect(page.getByText(userName(candidateClean))).not.toBeVisible()
    await expect(page.getByText(userName(consultant))).toBeVisible()
    await expect(page.getByText(userName(candidateWithPayment))).toBeVisible()
  })
})
