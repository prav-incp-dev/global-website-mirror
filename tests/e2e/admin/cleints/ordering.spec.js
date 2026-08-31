import { test, expect } from '../../fixtures.js'
import { getPrisma } from '../../db.js'

test.describe('ordering clients', () => {
  let adminId

  test.beforeEach(async () => {
    const prisma = getPrisma()

    const company = await prisma.company.create({
      data: {
        name: 'Ordering Test Company',
        wallet: '0x1111111111111111111111111111111111111111',
      },
    })

    const admin = await prisma.user.create({
      data: {
        email: 'ordering-admin@example.com',
        password: 'hashed',
        role: 'Admin',
        nick: '@ordering-admin',
        firstName: 'Ordering',
        lastName: 'Admin',
        phone: '+375290000800',
        memberId: 'DOM-00000000-0800',
        wallet: '0x1111111111111111111111111111111111111111',
        companyId: company.id,
      },
    })
    adminId = admin.id

    // Alice — Candidate, level 3, score 100
    await prisma.user.create({
      data: {
        email: 'alice@example.com',
        password: 'hashed',
        role: 'Candidate',
        nick: '@alice',
        firstName: 'Alice',
        lastName: 'Anderson',
        phone: '+375290000801',
        memberId: 'DOM-00000000-0801',
        wallet: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        companyId: company.id,
        level: 3,
        score: 100,
        parentId: null,
      },
    })

    // Bob — Consultant, level 1, score 300
    await prisma.user.create({
      data: {
        email: 'bob@example.com',
        password: 'hashed',
        role: 'Consultant',
        nick: '@bob',
        firstName: 'Bob',
        lastName: 'Brown',
        phone: '+375290000802',
        memberId: 'DOM-00000000-0802',
        wallet: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
        companyId: company.id,
        level: 1,
        score: 300,
        parentId: null,
      },
    })

    // Charlie — Candidate, level 2, score 200
    await prisma.user.create({
      data: {
        email: 'charlie@example.com',
        password: 'hashed',
        role: 'Candidate',
        nick: '@charlie',
        firstName: 'Charlie',
        lastName: 'Clark',
        phone: '+375290000803',
        memberId: 'DOM-00000000-0803',
        wallet: '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
        companyId: company.id,
        level: 2,
        score: 200,
        parentId: null,
      },
    })

    // David — Consultant, level 4, score 50 (created last = highest id)
    await prisma.user.create({
      data: {
        email: 'david@example.com',
        password: 'hashed',
        role: 'Consultant',
        nick: '@david',
        firstName: 'David',
        lastName: 'Davis',
        phone: '+375290000804',
        memberId: 'DOM-00000000-0804',
        wallet: '0xDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
        companyId: company.id,
        level: 4,
        score: 50,
        parentId: null,
      },
    })
  })

  test('ordering clients by different criteria', async ({ loginAs, page }) => {
    // 1. Login as admin and navigate to clients page
    await loginAs(adminId)
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Панель администратора' })).toBeVisible()
    await page.getByRole('button', { name: 'Клиенты' }).click()
    await page.waitForLoadState('networkidle')

    const rows = () => page.locator('table tbody tr')
    const getRowNames = async () => {
      return rows().locator('td:first-child').allTextContents()
    }

    // 2. Default sort (id descending): David, Charlie, Bob, Alice
    await expect(rows()).toHaveCount(4)
    let names = await getRowNames()
    expect(names).toEqual(['David Davis', 'Charlie Clark', 'Bob Brown', 'Alice Anderson'])

    // 3. Click sort button, select "В алфавитном порядке"
    await page.getByTitle('Сортировка').click()
    await page.getByText('В алфавитном порядке').click()
    await page.waitForLoadState('networkidle')
    await expect(rows().first()).toContainText('Alice Anderson')

    // 4. Alphabetical: Alice, Bob, Charlie, David
    names = await getRowNames()
    expect(names).toEqual(['Alice Anderson', 'Bob Brown', 'Charlie Clark', 'David Davis'])

    // 5. Click sort button, select "С высоким уровнем"
    await page.getByTitle('Сортировка').click()
    await page.getByText('С высоким уровнем').click()
    await page.waitForLoadState('networkidle')
    await expect(rows().first()).toContainText('David Davis')

    // 6. By level descending: David (4), Alice (3), Charlie (2), Bob (1)
    await expect(rows()).toHaveCount(4)
    names = await getRowNames()
    expect(names).toEqual(['David Davis', 'Alice Anderson', 'Charlie Clark', 'Bob Brown'])

    // 7. Click sort button, select "По статусу"
    await page.getByTitle('Сортировка').click()
    await page.getByText('По статусу').click()
    await page.waitForLoadState('networkidle')
    await expect(rows().first()).toContainText('Alice Anderson')

    // 8. By role ascending: Candidate before Consultant — Alice, Charlie, then Bob, David
    names = await getRowNames()
    expect(names).toEqual(['Alice Anderson', 'Charlie Clark', 'Bob Brown', 'David Davis'])

    // 9. Click sort button, select "Лидеры продаж"
    await page.getByTitle('Сортировка').click()
    await page.getByText('Лидеры продаж').click()
    await page.waitForLoadState('networkidle')
    await expect(rows().first()).toContainText('Bob Brown')

    // 10. By score descending: Bob (300), Charlie (200), Alice (100), David (50)
    names = await getRowNames()
    expect(names).toEqual(['Bob Brown', 'Charlie Clark', 'Alice Anderson', 'David Davis'])

    // 11. Click sort button, select "По умолчанию"
    await page.getByTitle('Сортировка').click()
    await page.getByText('По умолчанию').click()
    await page.waitForLoadState('networkidle')
    await expect(rows().first()).toContainText('David Davis')

    // 12. Back to default (id descending): David, Charlie, Bob, Alice
    names = await getRowNames()
    expect(names).toEqual(['David Davis', 'Charlie Clark', 'Bob Brown', 'Alice Anderson'])
  })
})
