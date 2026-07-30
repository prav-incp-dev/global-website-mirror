import { useState } from 'react'
import { PaymentStatus } from '@/generated/prisma/enums'
import styles from './index.module.css'

const STATUS_LABELS = {
  Pending: 'В ожидании',
  Completed: 'Оплачен',
  ToCancel: 'К отмене',
  Canceled: 'Отменен',
  Failed: 'Ошибка',
}

const formatDate = (value) => {
  if (!value) return '-'
  return new Date(value).toLocaleString('ru-RU')
}

const shortenHash = (value) => {
  if (!value || value.length < 12) return value
  return `${value.slice(0, 8)}...${value.slice(-6)}`
}

const PaymentsList = ({ payments, csrfToken, onCancel }) => {
  const [cancelError, setCancelError] = useState('')
  const [cancelingPaymentId, setCancelingPaymentId] = useState()

  const handleCancel = async (paymentId) => {
    setCancelError('')
    setCancelingPaymentId(paymentId)

    try {
      const response = await fetch(`/api/payments/${paymentId}/cancel`, {
        method: 'POST',
        headers: {
          'x-csrf-token': csrfToken,
        },
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Ошибка запроса на отмену')
      }

      onCancel(result.payment)
    } catch (err) {
      setCancelError(err.message || 'Ошибка запроса на отмену')
    } finally {
      setCancelingPaymentId(null)
    }
  }

  return (
    <div className={styles.paymentsSection}>
      <h3 className={styles.historyTitle}>История платежей</h3>

      {payments.length === 0 ? (
        <p className={styles.emptyState}>Платежей пока нет</p>
      ) : (
        <div className={styles.historyList}>
          {payments.map((payment) => {
            const canCancel = payment.status === PaymentStatus.Completed && payment.canCancel

            return (
              <div key={payment.id} className={styles.historyItem}>
                <div className={styles.historyHeader}>
                  <span className={styles.historyAmount}>{payment.amountUsd} USD</span>
                  <span className={styles.historyDate}>{formatDate(payment.createdAt)}</span>
                </div>

                <div className={styles.historyMetaRow}>
                  <span className={`${styles.statusBadge} ${styles[`status${payment.status}`] || ''}`}>
                    {STATUS_LABELS[payment.status] || payment.status}
                  </span>
                  <span className={styles.hashValue}>{shortenHash(payment.txHash)}</span>
                </div>

                {canCancel && (
                  <button
                    className={styles.cancelButton}
                    onClick={() => handleCancel(payment.id)}
                    disabled={cancelingPaymentId === payment.id}
                  >
                    {cancelingPaymentId === payment.id ? 'Отправка...' : 'Отменить'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {cancelError && <p className={styles.errorText}>{cancelError}</p>}
    </div>
  )
}

export default PaymentsList
