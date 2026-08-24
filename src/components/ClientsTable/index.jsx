import { useState, useRef, useEffect, useCallback } from 'react'
import { UserRole } from '@/generated/prisma/enums'
import styles from './index.module.css'

const ClientsTable = ({ initialUsers, initialPagination, csrfToken }) => {
  const [users, setUsers] = useState(initialUsers)
  const [pagination, setPagination] = useState(initialPagination)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef(null)

  const fetchClients = useCallback(async (page, searchQuery) => {
    setLoading(true)

    const params = new URLSearchParams({ page, limit: pagination.limit })
    if (searchQuery) {
      params.set('query', searchQuery)
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
    }
    setLoading(false)
  }, [csrfToken, pagination.limit])

  const handleSearchChange = (e) => {
    const value = e.target.value
    setQuery(value)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      fetchClients(1, value)
    }, 300)
  }

  const handlePageChange = async (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return
    await fetchClients(newPage, query)
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
        <td colSpan={3} className={styles.empty}>
          Нет клиентов
        </td>
      </tr>
    )
  }

  const usersList = () => {
    return users.map((user) => (
      <tr key={user.id} className={styles.row}>
        <td className={styles.td}>{`${user.firstName} ${user.lastName || ''}`.trim()}</td>
        <td className={styles.td}>{user.level}</td>
        <td className={styles.td}>
          <span className={styles.candidate}>{user.role === UserRole.Consultant ? 'Консультант' : 'Кандидат'}</span>
        </td>
      </tr>
    ))
  }

  return (
    <div className={styles.container}>
      <div className={styles.searchWrapper}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Поиск по имени..."
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
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? emptyRow() : usersList()}
          </tbody>
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
    </div>
  )
}

export default ClientsTable
