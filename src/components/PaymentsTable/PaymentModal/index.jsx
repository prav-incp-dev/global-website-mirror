import { useState } from 'react'
import { PaymentStatus } from '@/generated/prisma/enums'
import { usePaymentsContext } from '../PaymentsContext'
import Modal from '../../Modal'
import styles from './index.module.css'
import { PAYMENT_STATUSES } from '@/lib/payment'
import ChangeUIDModal from '../ChangeUIDModal'
import RefundModal from '../RefundModal'

const COMPLETE_CONFIRMATION_TEXT =
  'Вы подтверждаете, что платеж действительно поступил на распределительный счет компании?'

const REFUND_CONFIRMATION_TEXT = 'Вы подтверждаете, что деньги были возвращены пользователю?'

const PaymentModal = ({ onClose }) => {
  const { csrfToken, selectedPayment, updateSelectedPayment, fetchPayments } = usePaymentsContext()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showChangeUID, setShowChangeUID] = useState(false)
  const [showRefund, setShowRefund] = useState(false)

  if (!selectedPayment) return null

  const isFailed = selectedPayment.status === 'Failed'
  const isToRefund = selectedPayment.status === 'ToRefund'

  const handleComplete = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/payments/${selectedPayment.id}/complete`, {
        method: 'POST',
        headers: {
          'x-csrf-token': csrfToken,
        },
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)

      if (result.success) updateSelectedPayment({ id: selectedPayment.id, status: PaymentStatus.Completed })
    } catch (err) {
      setError(err.message || 'Ошибка зачтения платежа')
    } finally {
      setLoading(false)
    }
  }

  const handleRefund = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/payments/${selectedPayment.id}/refund`, {
        method: 'POST',
        headers: {
          'x-csrf-token': csrfToken,
        },
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)

      if (result.success) {
        updateSelectedPayment({ id: selectedPayment.id, status: PaymentStatus.Refunded })
        await fetchPayments()
      }
    } catch (err) {
      setError(err.message || 'Ошибка зачтения возврата платежа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Информация о платеже" onClose={onClose}>
      {showChangeUID && <ChangeUIDModal onClose={() => setShowChangeUID(false)} />}
      {showRefund && <RefundModal onClose={() => setShowRefund(false)} />}
      <div className={styles.infoTable}>
        <div className={styles.infoRow}>
          <span className={styles.label}>Сумма:</span>
          <span className={styles.value}>{selectedPayment.amount}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Номер платежа:</span>
          <span className={styles.value}>{selectedPayment.uid || '—'}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Статус:</span>
          <span className={styles.value}>{PAYMENT_STATUSES[selectedPayment.status] || selectedPayment.status}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Дата:</span>
          <span className={styles.value}>{new Date(selectedPayment.createdAt).toLocaleString('ru-RU')}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>txHash:</span>
          <span className={styles.value}>{selectedPayment.txHash || '—'}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>С адреса:</span>
          <span className={styles.value}>{selectedPayment.fromWallet || '—'}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Пользователь:</span>
          <span className={styles.value}>{selectedPayment.userName || '—'}</span>
        </div>
      </div>

      {(isFailed || isToRefund || selectedPayment.uid) && (
        <div className={styles.actions}>
          {isFailed && (
            <button
              className={styles.actionButton}
              onClick={async () => {
                if (window.confirm(COMPLETE_CONFIRMATION_TEXT)) await handleComplete()
              }}
              disabled={loading}
            >
              {loading ? 'Зачтение…' : 'Зачесть платеж'}
            </button>
          )}
          {isToRefund && (
            <button className={styles.actionButton} onClick={() => setShowRefund(true)}>
              Выполнить возврат
            </button>
          )}
          {isToRefund && (
            <button
              className={styles.actionButton}
              onClick={async () => {
                if (window.confirm(REFUND_CONFIRMATION_TEXT)) await handleRefund()
              }}
              disabled={loading}
            >
              {loading ? 'Возврат…' : 'Зачесть возврат'}
            </button>
          )}
          {selectedPayment.uid && (
            <button className={styles.actionButton} onClick={() => setShowChangeUID(true)}>
              Изменить номер платежа
            </button>
          )}
          {error && <span className={styles.error}>{error}</span>}
        </div>
      )}
    </Modal>
  )
}

export default PaymentModal
