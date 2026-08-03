import { describe, it, vi } from 'vitest'
import { createApp } from '../helpers'

describe('consultant plugin', () => {
  it('getStats returns children and null parent when user has no parentId', async ({ expect }) => {
    const app = await createApp()

    const mockChildren = [
      { id: 2, firstName: 'Child', lastName: 'One', nick: null, level: 1 },
      { id: 3, firstName: 'Child', lastName: 'Two', nick: null, level: 2 },
    ]
    vi.spyOn(app.prisma.user, 'findMany').mockResolvedValue(mockChildren)
    const findUniqueSpy = vi.spyOn(app.prisma.user, 'findUnique')

    const user = { id: 1, parentId: null }
    const result = await app.consultant.getStats(user)

    expect(result).toEqual({ children: mockChildren, parent: null })
    expect(findUniqueSpy).not.toHaveBeenCalled()
  })

  it('getStats returns children and parent when user has parentId', async ({ expect }) => {
    const app = await createApp()

    const mockChildren = [
      { id: 2, firstName: 'Child', lastName: 'One', nick: null, level: 1 },
    ]
    const mockParent = { id: 5, firstName: 'Parent', lastName: 'User', nick: null, level: 3 }

    vi.spyOn(app.prisma.user, 'findMany').mockResolvedValue(mockChildren)
    vi.spyOn(app.prisma.user, 'findUnique').mockResolvedValue(mockParent)

    const user = { id: 1, parentId: 5 }
    const result = await app.consultant.getStats(user)

    expect(result).toEqual({ children: mockChildren, parent: mockParent })
    expect(app.prisma.user.findMany).toHaveBeenCalledWith({
      where: { parentId: 1 },
      select: { id: true, firstName: true, lastName: true, nick: true, level: true },
    })
    expect(app.prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 5 },
      select: { id: true, firstName: true, lastName: true, nick: true, level: true },
    })
  })

  it('getStats returns empty children when user has no children', async ({ expect }) => {
    const app = await createApp()

    vi.spyOn(app.prisma.user, 'findMany').mockResolvedValue([])

    const user = { id: 1, parentId: null }
    const result = await app.consultant.getStats(user)

    expect(result).toEqual({ children: [], parent: null })
  })

  it('getStats passes correct select fields to Prisma', async ({ expect }) => {
    const app = await createApp()

    const findManySpy = vi.spyOn(app.prisma.user, 'findMany').mockResolvedValue([])
    const findUniqueSpy = vi.spyOn(app.prisma.user, 'findUnique').mockResolvedValue(null)

    const user = { id: 1, parentId: 5 }
    await app.consultant.getStats(user)

    const expectedSelect = { id: true, firstName: true, lastName: true, nick: true, level: true }

    expect(findManySpy).toHaveBeenCalledWith({
      where: { parentId: 1 },
      select: expectedSelect,
    })
    expect(findUniqueSpy).toHaveBeenCalledWith({
      where: { id: 5 },
      select: expectedSelect,
    })
  })
})
