import { createContext, useContext, useState, useCallback } from 'react'

const PaymentsContext = createContext(null)

export const usePaymentsContext = () => {
  const ctx = useContext(PaymentsContext)
  if (!ctx) {
    throw new Error('usePaymentsContext must be used within PaymentsProvider')
  }
  return ctx
}

export const PaymentsProvider = ({
  initialPayments,
  initialPagination,
  initialToRefundCount = 0,
  refundFee = 5,
  csrfToken,
  companyWallet,
  children,
}) => {
  const [payments, setPayments] = useState(initialPayments)
  const [pagination, setPagination] = useState(initialPagination)
  const [toRefundCount, setToRefundCount] = useState(initialToRefundCount)
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [query, setQuery] = useState('')
  const [toRefundOnly, setToRefundOnly] = useState(false)
  const [sortBy, setSortBy] = useState('id')
  const [loading, setLoading] = useState(false)

  const updateSelectedPayment = useCallback((data) => {
    setSelectedPayment((prev) => (prev ? { ...prev, ...data } : prev))
    setPayments((prev) => prev.map((u) => (u.id === data.id ? { ...u, ...data } : u)))
  }, [])

  const fetchPayments = useCallback(
    async (page = pagination.page, searchQuery = query, filterToRefundOnly = toRefundOnly, sortField = sortBy) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ page, limit: pagination.limit })
        if (searchQuery) params.set('query', searchQuery)
        if (filterToRefundOnly) params.set('toRefundOnly', 'true')
        if (sortField) params.set('sortBy', sortField)

        const res = await fetch(`/api/admin/payments?${params}`, {
          headers: {
            'x-csrf-token': csrfToken,
          },
        })
        const result = await res.json()
        if (result.payments) {
          setPayments(result.payments)
          setPagination({
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages,
          })
          if (result.toRefundCount != null) {
            setToRefundCount(result.toRefundCount)
          }
        }
      } finally {
        setLoading(false)
      }
    },
    [csrfToken, pagination.limit, pagination.page, query, toRefundOnly, sortBy],
  )

  return (
    <PaymentsContext.Provider
      value={{
        payments,
        setPayments,
        pagination,
        setPagination,
        toRefundCount,
        setToRefundCount,
        loading,
        setLoading,
        refundFee,
        csrfToken,
        companyWallet,
        selectedPayment,
        setSelectedPayment,
        updateSelectedPayment,
        fetchPayments,
        query,
        setQuery,
        toRefundOnly,
        setToRefundOnly,
        sortBy,
        setSortBy,
      }}
    >
      {children}
    </PaymentsContext.Provider>
  )
}
