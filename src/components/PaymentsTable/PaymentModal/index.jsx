import { useState } from 'react'
import classNames from 'classnames'
import { PaymentStatus } from '@/generated/prisma/enums'
import { usePaymentsContext } from '../PaymentsContext'
import Modal from '../../Modal'
import styles from './index.module.css'
import { PAYMENT_STATUSES } from '@/lib/payment'
import ChangeUIDModal from '../ChangeUIDModal'

const PaymentModal = ({ onClose }) => {
  const { csrfToken, selectedPayment, updateSelectedPayment, fetchPayments } = usePaymentsContext()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showChangeUID, setShowChangeUID] = useState(false)

  if (!selectedPayment) return null

  const isFailed = selectedPayment.status === 'Failed'

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

      if (result.success) {
        updateSelectedPayment({ id: selectedPayment.id, status: PaymentStatus.Completed })
        await fetchPayments()
      }
    } catch (err) {
      setError(err.message || 'Ошибка зачтения платежа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Информация о платеже" onClose={onClose}>
      {showChangeUID && <ChangeUIDModal onClose={() => setShowChangeUID(false)} />}
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
          <span className={styles.label}>Пользователь:</span>
          <span className={styles.value}>{selectedPayment.userName || '—'}</span>
        </div>
      </div>

      {(isFailed || selectedPayment.uid) && (
        <div className={styles.actions}>
          {isFailed && (
            <button
              className={classNames(styles.completeButton, { [styles.completeButtonDisabled]: loading })}
              onClick={handleComplete}
              disabled={loading}
            >
              {loading ? 'Зачтение…' : 'Зачесть платеж'}
            </button>
          )}
          {selectedPayment.uid && (
            <button className={styles.changeUidButton} onClick={() => setShowChangeUID(true)}>
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
