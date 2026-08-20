import { createContext, useContext, useState, useCallback } from 'react'

const DescendantsContext = createContext(null)

export const useDescendantsContext = () => {
  const ctx = useContext(DescendantsContext)
  if (!ctx) {
    throw new Error('useDescendantsContext must be used within DescendantsProvider')
  }
  return ctx
}

const updateDescendant = (descendants, userId, updates) => {
  return descendants.map((descendant) => {
    if (descendant.id === userId) {
      return { ...descendant, ...updates }
    }
    if (descendant.children && descendant.children.length > 0) {
      return { ...descendant, children: updateDescendant(descendant.children, userId, updates) }
    }
    return descendant
  })
}

export const DescendantsProvider = ({ descendants: initialDescendants, staleDays, currentUserId, children }) => {
  const [descendants, setDescendants] = useState(initialDescendants)

  const updateDescendantData = useCallback((userId, updates) => {
    setDescendants((prev) => updateDescendant(prev, userId, updates))
  }, [])

  return (
    <DescendantsContext.Provider value={{ descendants, updateDescendantData, staleDays, currentUserId }}>
      {children}
    </DescendantsContext.Provider>
  )
}
