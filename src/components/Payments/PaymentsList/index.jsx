import { useState } from 'react'
import classNames from 'classnames'
import { PaymentStatus } from '@/generated/prisma/enums'
import { usePaymentsContext } from '../PaymentsContext'
import ChevronIcon from '@/assets/icons/ChevronIcon.svg?react'
import styles from './index.module.css'
import { PAYMENT_STATUSES } from '@/lib/payment'

const getConfirmationText = (fee) => `Вы уверены, что хотите отменить платеж? При отмене взимается комиссия ${fee}%`

const PaymentsList = () => {
  const { payments, csrfToken, refundFee = 5, updatePayment, onRetry } = usePaymentsContext()
  const [cancelError, setCancelError] = useState('')
  const [actionError, setActionError] = useState('')
  const [cancelingPaymentId, setCancelingPaymentId] = useState()
  const [actionPaymentId, setActionPaymentId] = useState()
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

  const handleRetry = async (payment) => {
    setActionError('')
    setActionPaymentId(payment.id)

    try {
      const response = await fetch(`/api/payments/${payment.id}/retry`, {
        method: 'POST',
        headers: {
          'x-csrf-token': csrfToken,
        },
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Ошибка повторной оплаты')
      }

      updatePayment({ id: payment.id, status: 'Canceled' })

      if (onRetry) {
        onRetry({
          paymentId: result.paymentId,
          orderId: result.orderId,
          amountUsd: result.amountUsd,
          quantity: result.quantity,
        })
      }
    } catch (err) {
      setActionError(err.message || 'Ошибка повторной оплаты')
    } finally {
      setActionPaymentId(null)
    }
  }

  const handleUserCancel = async (payment) => {
    setActionError('')
    setActionPaymentId(payment.id)

    try {
      const response = await fetch(`/api/payments/${payment.id}/user-cancel`, {
        method: 'POST',
        headers: {
          'x-csrf-token': csrfToken,
        },
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Ошибка отмены покупки')
      }

      if (result.payment) updatePayment(result.payment)
    } catch (err) {
      setActionError(err.message || 'Ошибка отмены покупки')
    } finally {
      setActionPaymentId(null)
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
            const canCancel = payment.status === PaymentStatus.Completed && !payment.finalized
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
                      {PAYMENT_STATUSES[payment.status] || payment.status}
                    </span>
                    <span className={classNames(styles.chevron, { [styles.chevronOpen]: isExpanded })}>
                      <ChevronIcon className={styles.chevronIcon} />
                    </span>
                  </span>
                </div>

                {isExpanded && (
                  <div className={styles.details}>
                    <span className={styles.dateValue}>{new Date(payment.createdAt).toLocaleString('ru-RU')}</span>
                    <span className={styles.hashValue}>{payment.txHash || '-'}</span>
                    {payment.status === 'Unconfirmed' && (
                      <div className={styles.unconfirmedBlock}>
                        <span className={styles.unconfirmedText}>
                          Поступление не обнаружено. Оплатите повторно или отмените покупку.
                        </span>
                        <div className={styles.unconfirmedActions}>
                          <button
                            className={styles.retryButton}
                            onClick={() => handleRetry(payment)}
                            disabled={actionPaymentId === payment.id}
                          >
                            {actionPaymentId === payment.id ? 'Отправка...' : 'Оплатить повторно'}
                          </button>
                          <button
                            className={styles.cancelButton}
                            onClick={() => handleUserCancel(payment)}
                            disabled={actionPaymentId === payment.id}
                          >
                            Отменить покупку
                          </button>
                        </div>
                      </div>
                    )}
                    {canCancel ? (
                      <button
                        className={styles.cancelButton}
                        onClick={async () => {
                          if (window.confirm(getConfirmationText(refundFee))) await handleCancel(payment.id)
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
      {actionError && <p className={styles.errorText}>{actionError}</p>}
    </div>
  )
}

export default PaymentsList
