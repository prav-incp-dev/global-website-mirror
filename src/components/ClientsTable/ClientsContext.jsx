import { createContext, useContext, useState, useCallback, useMemo } from 'react'

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
  const [selectedUserId, setSelectedUserId] = useState(null)

  const selectedUser = useMemo(
    () => (selectedUserId ? (users.find((u) => u.id === selectedUserId) ?? null) : null),
    [selectedUserId, users],
  )

  const updateSelectedUser = useCallback(
    (data) => {
      setUsers((prev) => prev.map((u) => (u.id === selectedUserId ? { ...u, ...data } : u)))
    },
    [selectedUserId],
  )

  return (
    <ClientsContext.Provider
      value={{
        users,
        setUsers,
        pagination,
        setPagination,
        orphansCount,
        setOrphansCount,
        csrfToken,
        selectedUserId,
        setSelectedUserId,
        selectedUser,
        updateSelectedUser,
      }}
    >
      {children}
    </ClientsContext.Provider>
  )
}
