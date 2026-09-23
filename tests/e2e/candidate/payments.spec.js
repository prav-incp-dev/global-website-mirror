import { test, expect } from '../fixtures.js'
import { createTestCompany, createTestUser, createTestOrder } from '../db.js'

test.describe('candidate payment flow', () => {
  let company
  let candidate

  test.beforeEach(async () => {
    company = await createTestCompany('Candidate Payment Company')
  })

  test('wallet setup unlocks purchase button and stepper works', async ({ loginAs, page }) => {
    // create test candidate
    candidate = await createTestUser({
      firstName: 'Candidate',
      lastName: 'User',
      role: 'Candidate',
      companyId: company.id,
      wallet: null,
    })
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
    await expect(page.getByRole('heading', { name: 'Количество единиц' })).toBeVisible()

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

  test('user sees error and canceled payment is hidden after transaction rejection', async ({ loginAs, page }) => {
    const MOCK_ACCOUNT = '0x1234567890abcdef1234567890abcdef22222222'

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

    // create test candidate
    const candidate = await createTestUser({
      firstName: 'Cancel',
      lastName: 'Test',
      role: 'Candidate',
      companyId: company.id,
      wallet: MOCK_ACCOUNT,
    })

    await loginAs(candidate.id)

    // Go to payments tab
    await page.getByRole('button', { name: 'Покупки' }).click()
    await page.getByRole('button', { name: 'Купить' }).click()
    await expect(page.getByRole('heading', { name: 'Количество единиц' })).toBeVisible()
    await page.getByRole('button', { name: 'Оплатить' }).click()

    // Error message is shown (viem translates code 4001 to 'User rejected the request.')
    await expect(page.getByText('Ошибка сети: User rejected the request.')).toBeVisible()

    // Close modal
    await page.getByRole('button', { name: 'Закрыть' }).click()

    // No payments visible — canceled payments are filtered out on the server side
    await expect(page.getByText('Платежей пока нет')).toBeVisible()

    // Reload — payment remains filtered out server-side
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Покупки' }).click()
    await expect(page.getByText('Платежей пока нет')).toBeVisible()
  })

  test('user full payment flow', async ({ loginAs, page }) => {
    // create test candidate
    const candidate = await createTestUser({
      firstName: 'Full',
      lastName: 'Flow',
      role: 'Candidate',
      companyId: company.id,
      wallet: '0x1234567890abcdef1234567890abcdef22222222',
    })

    const order = await createTestOrder(company, candidate, 1200, 'Completed')
    const payment = order.payment

    await loginAs(candidate.id)

    // Go to payments tab — see seeded payment
    await page.getByRole('button', { name: 'Покупки' }).click()
    await expect(page.getByText('1200 USD')).toBeVisible()
    await expect(page.getByText('Оплачен')).toBeVisible()

    // Expand payment — see txHash and cancel button
    const historyItem = page.locator('[class*="historyItem"]').first()
    await historyItem.click()
    await expect(page.getByText(payment.txHash)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Отменить' })).toBeVisible()

    // Click cancel — accept confirm dialog — status changes to 'Отмена'
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Отменить' }).click()
    await expect(page.getByText('Отмена')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Отменить' })).not.toBeVisible()

    // Reload — status persists
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Покупки' }).click()
    await expect(page.getByText('1200 USD')).toBeVisible()
    await expect(page.getByText('Отмена')).toBeVisible()
  })
})
