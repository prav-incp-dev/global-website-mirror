import { test, expect } from '../fixtures.js'
import { getPrisma } from '../db.js'
import bcrypt from 'bcryptjs'

const passwordHashRounds = 12
const testPasswordHash = bcrypt.hashSync('password', passwordHashRounds)

test.describe('consultant profile with stats', () => {
  test.beforeEach(async () => {
    const prisma = getPrisma()

    // Create parent consultant
    const parentConsultant = await prisma.user.create({
      data: {
        email: 'parent-consultant@example.com',
        password: testPasswordHash,
        role: 'Consultant',
        nick: '@parentcons',
        firstName: 'Parent',
        lastName: 'Consultant',
        phone: '+375330000010',
        memberId: 'DOM-00000000-0010',
        wallet: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        companyId: 1,
        level: 3,
      },
    })

    // Update existing consultant (id=2) with parent, level, score, groupScore
    await prisma.user.update({
      where: { id: 2 },
      data: {
        parentId: parentConsultant.id,
        level: 5,
        score: 7,
        groupScore: 60,
      },
    })
  })

  test('consultant views profile, edits data, checks payments and stats', async ({ loginAs, page }) => {
    // Log in as consultant (id=2)
    await loginAs(2)

    // --- Verify invite button is visible ---
    await expect(page.getByRole('button', { name: 'Сгенерировать пригласительную ссылку' })).toBeVisible()

    // --- Verify "Ваш пригласитель" is NOT visible (only for Candidate) ---
    await expect(page.getByText('Ваш пригласитель:')).not.toBeVisible()

    // --- Verify initial profile data ---
    await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible()
    await expect(page.getByText('Consultant', { exact: true })).toBeVisible()
    await expect(page.getByText('Inviter', { exact: true })).toBeVisible()
    await expect(page.getByText('consultant@example.com')).toBeVisible()

    // --- Verify balance button is visible (consultant has wallet)
    await expect(page.getByRole('button', { name: 'Проверить баланс' })).toBeVisible()

    // Mock balance API to always fail (avoids dependency on real RPC)
    await page.route('**/api/user/balance', (route) => {
      route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Не удалось получить баланс' }),
      })
    })

    await page.getByRole('button', { name: 'Проверить баланс' }).click()
    await expect(page.getByText('Не удалось получить баланс')).toBeVisible()

    // --- Edit profile ---
    await page.getByRole('button', { name: 'Редактировать' }).click()
    await page.locator('#firstName').fill('UpdatedConsultant')
    await page.locator('#wallet').fill('')
    await page.getByRole('button', { name: 'Сохранить' }).click()

    // --- Verify updated data ---
    await expect(page.getByText('UpdatedConsultant')).toBeVisible()
    // --- Verify balance button is no longe visible (consultant removed wallet)
    await expect(page.getByRole('button', { name: 'Проверить баланс' })).not.toBeVisible()

    // --- Navigate to Покупки tab ---
    await page.getByRole('button', { name: 'Покупки' }).click()
    await expect(page.getByRole('button', { name: 'Купить' })).toBeVisible()

    // --- Navigate to Статистика tab ---
    await page.getByRole('button', { name: 'Статистика' }).click()

    // --- Verify first table: level, score, groupScore ---
    await expect(page.getByRole('cell', { name: '5' })).toBeVisible()
    await expect(page.getByRole('cell', { name: '7' })).toBeVisible()
    await expect(page.getByRole('cell', { name: '60' })).toBeVisible()

    // --- Verify Пригласитель section ---
    await expect(page.getByRole('heading', { name: 'Пригласитель' })).toBeVisible()
    await expect(page.getByRole('cell', { name: '@parentcons' })).toBeVisible()
    // Parent level = 3 should be in the same row as @parentcons
    await expect(page.getByText('Пригласитель').locator('..').getByRole('cell', { name: '3' })).toBeVisible()
  })
})
