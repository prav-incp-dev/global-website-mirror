import { useState, useEffect, useCallback, useRef } from 'react'
import { WAGES_LIMIT } from '@/lib/constants'
import WageRow from '@/components/Wages/WageRow'
import Sorter from '@/components/Sorter'
import styles from './index.module.css'

const SORT_OPTIONS = [
  { value: 'id', label: 'По умолчанию' },
  { value: 'amount_asc', label: 'По возрастанию суммы' },
  { value: 'amount_desc', label: 'По убыванию суммы' },
]

const Wages = ({ csrfToken }) => {
  const [wages, setWages] = useState([])
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0, limit: WAGES_LIMIT })
  const [loading, setLoading] = useState(true)
  const [expandedWageIds, setExpandedWageIds] = useState([])
  const [sortBy, setSortBy] = useState('id')
  const [query, setQuery] = useState('')
  const debounceRef = useRef(null)

  const fetchWages = useCallback(
    async (page = 1, sort = 'id', search = '') => {
      try {
        const params = new URLSearchParams({ page, limit: String(pagination.limit), sortBy: sort })
        if (search) params.set('query', search)
        const res = await fetch(`/api/user/wages?${params}`, {
          headers: {
            'x-csrf-token': csrfToken,
          },
        })
        const result = await res.json()
        if (result.wages) {
          setWages(result.wages)
          setPagination({
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages,
          })
        }
      } finally {
        setLoading(false)
      }
    },
    [csrfToken, pagination.limit],
  )

  useEffect(() => {
    fetchWages(1, 'id', '')
  }, [fetchWages])

  const handleSortChange = (value) => {
    setSortBy(value)
    fetchWages(1, value, query)
  }

  const handleSearchChange = (e) => {
    const value = e.target.value
    setQuery(value)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      fetchWages(1, sortBy, value)
    }, 300)
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const toggleExpanded = (wageId) => {
    setExpandedWageIds((current) =>
      current.includes(wageId) ? current.filter((id) => id !== wageId) : current.concat(wageId),
    )
  }

  const handlePageChange = async (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return
    setLoading(true)
    await fetchWages(newPage, sortBy, query)
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <Sorter sortBy={sortBy} onSortChange={handleSortChange} options={SORT_OPTIONS} />
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Поиск"
          value={query}
          onChange={handleSearchChange}
        />
      </div>

      {wages.length === 0 && !loading ? (
        <p className={styles.emptyState}>Начислений пока нет</p>
      ) : (
        <div className={styles.listWrapper}>
          <div className={styles.list}>
            {wages.map((wage) => (
              <WageRow
                key={wage.id}
                wage={wage}
                isExpanded={expandedWageIds.includes(wage.id)}
                onToggle={toggleExpanded}
              />
            ))}
          </div>
          {loading && (
            <div className={styles.loadingOverlay}>
              <span className={styles.spinnerLarge} />
            </div>
          )}
        </div>
      )}

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

export default Wages
