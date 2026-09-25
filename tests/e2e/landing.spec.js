import { test, expect } from './fixtures.js'
import { createTestCompany, createTestUser } from './db.js'

const BASE_URL = 'http://[IP_ADDRESS]:3101'

test.describe('landing page / authorization redirects', () => {
  let admin
  let consultant
  let candidate

  test.beforeEach(async () => {
    const company = await createTestCompany('Landing Test Company')

    admin = await createTestUser({ firstName: 'Alice', lastName: 'Admin', role: 'Admin', companyId: company.id })
    consultant = await createTestUser({
      firstName: 'Bob',
      lastName: 'Consultant',
      role: 'Consultant',
      companyId: company.id,
    })
    candidate = await createTestUser({
      firstName: 'Carol',
      lastName: 'Candidate',
      role: 'Candidate',
      companyId: company.id,
    })
  })

  test('shows landing page for unauthenticated user', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'International Club of Participants' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'ВОЙТИ' })).toBeVisible()
  })

  test('redirects authorized admin to /admin', async ({ loginAs, page }) => {
    await loginAs(admin.id)
    await page.goto('/')

    await expect(page).toHaveURL('http://127.0.0.1:3101/admin')
    await expect(page.getByRole('heading', { name: 'Админка' })).toBeVisible()
  })

  test('redirects authorized consultant to /home', async ({ loginAs, page }) => {
    await loginAs(consultant.id)
    await page.goto('/')

    await expect(page).toHaveURL('http://127.0.0.1:3101/home')
    await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible()
  })

  test('redirects authorized candidate to /home', async ({ loginAs, page }) => {
    await loginAs(candidate.id)
    await page.goto('/')

    await expect(page).toHaveURL('http://127.0.0.1:3101/home')
    await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible()
  })
})
