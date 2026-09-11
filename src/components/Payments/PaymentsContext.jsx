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
  initialPayments = [],
  csrfToken,
  refundFee,
  profile = {},
  prices = {},
  children,
}) => {
  const [payments, setPayments] = useState(initialPayments)

  const addPayment = useCallback((payment) => {
    setPayments((prev) => [payment, ...prev])
  }, [])

  const updatePayment = useCallback((payment) => {
    setPayments((prev) => prev.map((p) => (p.id === payment.id ? payment : p)))
  }, [])

  return (
    <PaymentsContext.Provider
      value={{ payments, setPayments, addPayment, updatePayment, csrfToken, refundFee, profile, prices }}
    >
      {children}
    </PaymentsContext.Provider>
  )
}
