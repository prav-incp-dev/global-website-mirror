import { createContext, useContext, useState } from 'react'

const ClientsContext = createContext(null)

export const useClientsContext = () => {
  const ctx = useContext(ClientsContext)
  if (!ctx) {
    throw new Error('useClientsContext must be used within ClientsProvider')
  }
  return ctx
}

export const ClientsProvider = ({ initialUsers, initialPagination, initialOrphansCount = 0, csrfToken, children }) => {
  const [users, setUsers] = useState(initialUsers)
  const [pagination, setPagination] = useState(initialPagination)
  const [orphansCount, setOrphansCount] = useState(initialOrphansCount)

  return (
    <ClientsContext.Provider value={{ users, setUsers, pagination, setPagination, orphansCount, setOrphansCount, csrfToken }}>
      {children}
    </ClientsContext.Provider>
  )
}
