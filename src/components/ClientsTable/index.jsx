import { useState, useRef, useEffect, useCallback } from 'react'
import { UserRole } from '@/generated/prisma/enums'
import styles from './index.module.css'
import InfoIcon from '@/assets/icons/InfoIcon.svg?react'
import ClientModal from './ClientModal'
import { ClientsProvider, useClientsContext } from './ClientsContext'
import { userName } from '@/lib/user'

const ClientsTableInner = () => {
  const {
    users,
    setUsers,
    pagination,
    setPagination,
    orphansCount,
    setOrphansCount,
    csrfToken,
    selectedUserId,
    setSelectedUserId,
  } = useClientsContext()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [orphansOnly, setOrphansOnly] = useState(false)
  const debounceRef = useRef(null)

  const fetchClients = useCallback(
    async (page, searchQuery, filterOrphansOnly) => {
      setLoading(true)

      const params = new URLSearchParams({ page, limit: pagination.limit })
      if (searchQuery) {
        params.set('query', searchQuery)
      }
      if (filterOrphansOnly) {
        params.set('orphansOnly', 'true')
      }

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
      setLoading(false)
    },
    [csrfToken, pagination.limit, setUsers, setPagination, setOrphansCount],
  )

  const handleSearchChange = (e) => {
    const value = e.target.value
    setQuery(value)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      fetchClients(1, value, orphansOnly)
    }, 300)
  }

  const handlePageChange = async (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return
    await fetchClients(newPage, query, orphansOnly)
  }

  const handleOrphansToggle = () => {
    const next = !orphansOnly
    setOrphansOnly(next)
    fetchClients(1, query, next)
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const emptyRow = () => {
    return (
      <tr>
        <td colSpan={4} className={styles.empty}>
          Нет клиентов
        </td>
      </tr>
    )
  }

  const usersList = () => {
    return users.map((user) => (
      <tr key={user.id} className={styles.row}>
        <td className={styles.td}>{userName(user)}</td>
        <td className={styles.td}>{user.level}</td>
        <td className={styles.td}>
          <span className={styles.candidate}>{user.role === UserRole.Consultant ? 'Консультант' : 'Кандидат'}</span>
        </td>
        <td className={styles.td} title="Данные пользователя">
          <InfoIcon className={styles.infoIcon} onClick={() => setSelectedUserId(user.id)} />
        </td>
      </tr>
    ))
  }

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <button
          className={`${styles.orphansToggle} ${orphansOnly ? styles.orphansToggleActive : ''}`}
          onClick={handleOrphansToggle}
          disabled={!orphansCount}
        >
          Без родителя ({orphansCount})
        </button>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Поиск (имя, почта)"
          value={query}
          onChange={handleSearchChange}
        />
      </div>

      <div className={styles.tableWrapper}>
        <table className={`${styles.table} ${loading ? styles.tableLoading : ''}`}>
          <thead>
            <tr>
              <th className={styles.th}>Имя</th>
              <th className={styles.th}>Ур.</th>
              <th className={styles.th}>Статус</th>
              <th className={styles.th}></th>
            </tr>
          </thead>
          <tbody>{users.length === 0 ? emptyRow() : usersList()}</tbody>
        </table>
        {loading && (
          <div className={styles.loadingOverlay}>
            <span className={styles.spinnerLarge} />
          </div>
        )}
      </div>

      {pagination.totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.pageButton}
            disabled={pagination.page <= 1 || loading}
            onClick={() => handlePageChange(pagination.page - 1)}
          >
            Назад
          </button>
          <span className={styles.pageInfo}>
            {pagination.page} из {pagination.totalPages}
          </span>
          <button
            className={styles.pageButton}
            disabled={pagination.page >= pagination.totalPages || loading}
            onClick={() => handlePageChange(pagination.page + 1)}
          >
            Вперёд
          </button>
        </div>
      )}

      {selectedUserId && <ClientModal onClose={() => setSelectedUserId(null)} />}
    </div>
  )
}

const ClientsTable = ({ initialUsers, initialPagination, initialOrphansCount = 0, csrfToken }) => {
  return (
    <ClientsProvider
      initialUsers={initialUsers}
      initialPagination={initialPagination}
      initialOrphansCount={initialOrphansCount}
      csrfToken={csrfToken}
    >
      <ClientsTableInner />
    </ClientsProvider>
  )
}

export default ClientsTable
