import { createContext, useContext, useState, useCallback } from 'react'
import { MIN_LEVEL, MAX_LEVEL } from '@/lib/constants'

const ClientsContext = createContext(null)

export const useClientsContext = () => {
  const ctx = useContext(ClientsContext)
  if (!ctx) {
    throw new Error('useClientsContext must be used within ClientsProvider')
  }
  return ctx
}

export const ClientsProvider = ({ initialUsers, initialPagination, initialOrphansCount = 0, csrfToken, companyWallet, children }) => {
  const [users, setUsers] = useState(initialUsers)
  const [pagination, setPagination] = useState(initialPagination)
  const [orphansCount, setOrphansCount] = useState(initialOrphansCount)
  const [selectedUser, setSelectedUser] = useState(null)
  const [query, setQuery] = useState('')
  const [orphansOnly, setOrphansOnly] = useState(false)
  const [sortBy, setSortBy] = useState('id')
  const [loading, setLoading] = useState(false)
  const [fromLevel, setFromLevel] = useState(MIN_LEVEL)
  const [toLevel, setToLevel] = useState(MAX_LEVEL)

  const updateSelectedUser = useCallback((data) => {
    setSelectedUser((prev) => (prev ? { ...prev, ...data } : prev))
    setUsers((prev) => prev.map((u) => (u.id === data.id ? { ...u, ...data } : u)))
  }, [])

  const fetchClients = useCallback(
    async (
      page = pagination.page,
      searchQuery = query,
      filterOrphansOnly = orphansOnly,
      sortField = sortBy,
      filterFromLevel = fromLevel,
      filterToLevel = toLevel,
    ) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ page, limit: pagination.limit })
        if (searchQuery) params.set('query', searchQuery)
        if (filterOrphansOnly) params.set('orphansOnly', 'true')
        if (sortField) params.set('sortBy', sortField)
        params.set('fromLevel', String(filterFromLevel))
        params.set('toLevel', String(filterToLevel))

        const res = await fetch(`/api/admin/clients?${params}`, {
          headers: {
            'x-csrf-token': csrfToken,
          },
        })
        const result = await res.json()
        if (result.users) {
          setUsers(result.users)
          setPagination({
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages,
          })
          if (result.orphansCount != null) {
            setOrphansCount(result.orphansCount)
          }
        }
      } finally {
        setLoading(false)
      }
    },
    [csrfToken, pagination.limit, pagination.page, query, orphansOnly, sortBy, fromLevel, toLevel],
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
        loading,
        setLoading,
        csrfToken,
        companyWallet,
        selectedUser,
        setSelectedUser,
        updateSelectedUser,
        fetchClients,
        query,
        setQuery,
        orphansOnly,
        setOrphansOnly,
        sortBy,
        setSortBy,
        fromLevel,
        setFromLevel,
        toLevel,
        setToLevel,
      }}
    >
      {children}
    </ClientsContext.Provider>
  )
}
