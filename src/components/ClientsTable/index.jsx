import { useRef, useEffect } from 'react'
import { UserRole } from '@/generated/prisma/enums'
import styles from './index.module.css'
import InfoIcon from '@/assets/icons/InfoIcon.svg?react'
import ClientModal from './ClientModal'
import { ClientsProvider, useClientsContext } from './ClientsContext'
import { userName } from '@/lib/user'
import Sorter from '../Sorter'

const SORT_OPTIONS = [
  { value: 'id', label: 'По умолчанию' },
  { value: 'name', label: 'В алфавитном порядке' },
  { value: 'level', label: 'С высоким уровнем' },
  { value: 'role', label: 'По статусу' },
  { value: 'score', label: 'Лидеры продаж' },
]

const ClientsTableInner = () => {
  const {
    users,
    pagination,
    orphansCount,
    loading,
    selectedUser,
    setSelectedUser,
    fetchClients,
    query,
    setQuery,
    orphansOnly,
    setOrphansOnly,
    sortBy,
    setSortBy,
  } = useClientsContext()
  const debounceRef = useRef(null)

  const handleSearchChange = (e) => {
    const value = e.target.value
    setQuery(value)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      fetchClients(1, value, orphansOnly, sortBy)
    }, 300)
  }

  const handlePageChange = async (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return
    await fetchClients(newPage, query, orphansOnly, sortBy)
  }

  const handleOrphansToggle = () => {
    const next = !orphansOnly
    setOrphansOnly(next)
    fetchClients(1, query, next, sortBy)
  }

  const handleSortChange = (value) => {
    setSortBy(value)
    fetchClients(1, query, orphansOnly, value)
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
          <InfoIcon className={styles.infoIcon} onClick={() => setSelectedUser(user)} />
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
          disabled={!orphansCount && !orphansOnly}
        >
          Открепленные ({orphansCount})
        </button>
        <Sorter sortBy={sortBy} onSortChange={handleSortChange} options={SORT_OPTIONS} />
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

      {selectedUser && <ClientModal onClose={() => setSelectedUser(null)} />}
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
