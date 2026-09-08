import { useRef, useEffect } from 'react'
import styles from './index.module.css'
import InfoIcon from '@/assets/icons/InfoIcon.svg?react'
import PaymentModal from './PaymentModal'
import { PaymentsProvider, usePaymentsContext } from './PaymentsContext'
import { PAYMENT_STATUSES } from '@/lib/payment'
import Sorter from '../Sorter'

const SORT_OPTIONS = [
  { value: 'id', label: 'По умолчанию' },
  { value: 'status', label: 'По статусу' },
  { value: 'amount', label: 'По сумме' },
]

const PaymentsTableInner = () => {
  const {
    payments,
    pagination,
    toRefundCount,
    loading,
    selectedPayment,
    setSelectedPayment,
    fetchPayments,
    query,
    setQuery,
    toRefundOnly,
    setToRefundOnly,
    sortBy,
    setSortBy,
  } = usePaymentsContext()
  const debounceRef = useRef(null)

  const handleSearchChange = (e) => {
    const value = e.target.value
    setQuery(value)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      fetchPayments(1, value, toRefundOnly, sortBy)
    }, 300)
  }

  const handlePageChange = async (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return
    await fetchPayments(newPage, query, toRefundOnly, sortBy)
  }

  const handleToRefundToggle = () => {
    const next = !toRefundOnly
    setToRefundOnly(next)
    fetchPayments(1, query, next, sortBy)
  }

  const handleSortChange = (value) => {
    setSortBy(value)
    fetchPayments(1, query, toRefundOnly, value)
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
          Нет платежей
        </td>
      </tr>
    )
  }

  const paymentsList = () => {
    return payments.map((item) => {
      const payment = item.payment || item
      return (
        <tr key={payment.id} className={styles.row}>
          <td className={styles.td}>{payment.amount}</td>
          <td className={styles.td}>{payment.uid || '—'}</td>
          <td className={styles.td}>
            <span className={styles.status}>{PAYMENT_STATUSES[payment.status] || payment.status}</span>
          </td>
          <td className={styles.td} title="Информация о платеже">
            <InfoIcon className={styles.infoIcon} onClick={() => setSelectedPayment(item)} />
          </td>
        </tr>
      )
    })
  }

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <button
          className={`${styles.refundToggle} ${toRefundOnly ? styles.refundToggleActive : ''}`}
          onClick={handleToRefundToggle}
          disabled={!toRefundCount && !toRefundOnly}
        >
          Отмена ({toRefundCount})
        </button>
        <Sorter sortBy={sortBy} onSortChange={handleSortChange} options={SORT_OPTIONS} />
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Поиск"
          value={query}
          onChange={handleSearchChange}
        />
      </div>

      <div className={styles.tableWrapper}>
        <table className={`${styles.table} ${loading ? styles.tableLoading : ''}`}>
          <thead>
            <tr>
              <th className={styles.th}>Сумма</th>
              <th className={styles.th}>UID</th>
              <th className={styles.th}>Статус</th>
              <th className={styles.th}></th>
            </tr>
          </thead>
          <tbody>{payments.length === 0 ? emptyRow() : paymentsList()}</tbody>
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

      {selectedPayment && <PaymentModal onClose={() => setSelectedPayment(null)} />}
    </div>
  )
}

const PaymentsTable = ({ initialPayments, initialPagination, initialToRefundCount = 0, csrfToken }) => {
  return (
    <PaymentsProvider
      initialPayments={initialPayments}
      initialPagination={initialPagination}
      initialToRefundCount={initialToRefundCount}
      csrfToken={csrfToken}
    >
      <PaymentsTableInner />
    </PaymentsProvider>
  )
}

export default PaymentsTable
