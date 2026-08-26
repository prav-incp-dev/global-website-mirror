import { test } from 'vitest'
import { userName } from '@/lib/user'

describe('userName', () => {
  test('joins firstName and lastName with a single space', ({ expect }) => {
    expect(userName({ firstName: 'John', lastName: 'Doe' })).toBe('John Doe')
  })

  test('returns only firstName when lastName is empty', ({ expect }) => {
    expect(userName({ firstName: 'John', lastName: '' })).toBe('John')
  })

  test('returns only firstName when lastName is null', ({ expect }) => {
    expect(userName({ firstName: 'John', lastName: null })).toBe('John')
  })
})
