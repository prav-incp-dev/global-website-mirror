import { test, expect } from '../fixtures.js'
import { createTestCompany, createTestUser } from '../db.js'

test.describe('candidate payment flow', () => {
  let candidate

  test.beforeEach(async () => {
    const company = await createTestCompany('Candidate Payment Company')
    candidate = await createTestUser({
      firstName: 'Candidate',
      lastName: 'User',
      role: 'Candidate',
      companyId: company.id,
      wallet: null,
    })
  })

  test('wallet setup unlocks purchase button and stepper works', async ({ loginAs, page }) => {
    // Login as candidate
    await loginAs(candidate.id)

    // Click 'Покупки' tab — verify button disabled + error message
    await page.getByRole('button', { name: 'Покупки' }).click()
    const buyButton = page.getByRole('button', { name: 'Купить' })
    await expect(buyButton).toBeDisabled()
    await expect(page.getByText('Для совершения покупок необходимо добавить кошелёк в профиле')).toBeVisible()

    // Go to Профиль → Редактировать, enter valid wallet, save
    await page.getByRole('button', { name: 'Профиль' }).click()
    await page.getByRole('button', { name: 'Редактировать' }).click()
    await page.locator('#wallet').fill('0x1234567890abcdef1234567890abcdef22222222')
    await page.getByRole('button', { name: 'Сохранить' }).click()

    // Back to Покупки — button now enabled
    await page.getByRole('button', { name: 'Покупки' }).click()
    await expect(buyButton).toBeEnabled()

    // Click Купить — modal appears
    await buyButton.click()

    // Verify stepper: count=0, amount=100 USD, '-' disabled
    await expect(page.getByText('0', { exact: true })).toBeVisible()
    await expect(page.getByText('100 USD')).toBeVisible()
    const minusBtn = page.getByRole('button', { name: 'Уменьшить' })
    const plusBtn = page.getByRole('button', { name: 'Увеличить' })
    await expect(minusBtn).toBeDisabled()

    // Click '+' → count=1, amount=1200, '-' enabled
    await plusBtn.click()
    await expect(page.getByText('1', { exact: true })).toBeVisible()
    await expect(page.getByText('1200 USD')).toBeVisible()
    await expect(minusBtn).toBeEnabled()

    // Click '+' → count=2, amount=2400
    await plusBtn.click()
    await expect(page.getByText('2', { exact: true })).toBeVisible()
    await expect(page.getByText('2400 USD')).toBeVisible()

    // Click '+' → count=3, amount=3600
    await plusBtn.click()
    await expect(page.getByText('3', { exact: true })).toBeVisible()
    await expect(page.getByText('3600 USD')).toBeVisible()

    // Click '+' → count=4, amount=4800
    await plusBtn.click()
    await expect(page.getByText('4', { exact: true })).toBeVisible()
    await expect(page.getByText('4800 USD')).toBeVisible()

    // Click '+' → count=5, amount=6000, '+' disabled
    await plusBtn.click()
    await expect(page.getByText('5', { exact: true })).toBeVisible()
    await expect(page.getByText('6000 USD')).toBeVisible()
    await expect(plusBtn).toBeDisabled()

    // Click close → modal closed
    await page.getByRole('button', { name: 'Закрыть' }).click()
    await expect(page.getByText('Сумма')).not.toBeVisible()
  })
})
