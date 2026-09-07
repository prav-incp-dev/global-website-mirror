import { useState } from 'react'
import classNames from 'classnames'
import { PaymentStatus } from '@/generated/prisma/enums'
import { usePaymentsContext } from '../PaymentsContext'
import ChevronIcon from '@/assets/icons/ChevronIcon.svg?react'
import styles from './index.module.css'

const STATUS_LABELS = {
  Pending: 'В ожидании',
  Completed: 'Оплачен',
  ToRefund: 'Ожидает отмены',
  Canceled: 'Отменен',
  Failed: 'Ошибка',
}

const getConfirmationText = (fee) => `Вы уверены, что хотите отменить платеж? При отмене взимается комиссия ${fee}%`

const formatDate = (value) => {
  if (!value) return '-'
  return new Date(value).toLocaleString('ru-RU')
}

const PaymentsList = () => {
  const { payments, csrfToken, cancellationFee = 5, updatePayment } = usePaymentsContext()
  const [cancelError, setCancelError] = useState('')
  const [cancelingPaymentId, setCancelingPaymentId] = useState()
  const [expandedPaymentIds, setExpandedPaymentIds] = useState([])

  const handleCancel = async (paymentId) => {
    setCancelError('')
    setCancelingPaymentId(paymentId)

    try {
      const response = await fetch(`/api/payments/${paymentId}/request-refund`, {
        method: 'POST',
        headers: {
          'x-csrf-token': csrfToken,
        },
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Ошибка запроса на отмену')
      }

      updatePayment(result.payment)
    } catch (err) {
      setCancelError(err.message || 'Ошибка запроса на отмену')
    } finally {
      setCancelingPaymentId(null)
    }
  }

  const toggleExpanded = (paymentId) => {
    setExpandedPaymentIds((current) =>
      current.includes(paymentId) ? current.filter((id) => id !== paymentId) : current.concat(paymentId),
    )
  }

  return (
    <div className={styles.paymentsSection}>
      <h3 className={styles.historyTitle}>История платежей</h3>

      {payments.length === 0 ? (
        <p className={styles.emptyState}>Платежей пока нет</p>
      ) : (
        <div className={styles.historyList}>
          {payments.map((payment) => {
            const canCancel = payment.status === PaymentStatus.Completed && !payment.uid
            const isExpanded = expandedPaymentIds.includes(payment.id)

            return (
              <div key={payment.id} className={styles.historyItem}>
                <div
                  className={styles.historyHeader}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onClick={() => toggleExpanded(payment.id)}
                >
                  <span className={styles.historyAmount}>{payment.amountUsd} USD</span>
                  <span className={styles.headerRight}>
                    <span className={classNames(styles.statusBadge, styles[`status${payment.status}`])}>
                      {STATUS_LABELS[payment.status] || payment.status}
                    </span>
                    <span className={classNames(styles.chevron, { [styles.chevronOpen]: isExpanded })}>
                      <ChevronIcon className={styles.chevronIcon} />
                    </span>
                  </span>
                </div>

                {isExpanded && (
                  <div className={styles.details}>
                    <span className={styles.dateValue}>{formatDate(payment.createdAt)}</span>
                    <span className={styles.hashValue}>{payment.txHash || '-'}</span>
                    {canCancel ? (
                      <button
                        className={styles.cancelButton}
                        onClick={async () => {
                          if (window.confirm(getConfirmationText(cancellationFee))) {
                            await handleCancel(payment.id)
                          }
                        }}
                        disabled={cancelingPaymentId === payment.id}
                      >
                        {cancelingPaymentId === payment.id ? 'Отправка...' : 'Отменить'}
                      </button>
                    ) : (
                      <span className={styles.uidValue}>{payment.uid}</span>
                    )}
                  </div>
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
