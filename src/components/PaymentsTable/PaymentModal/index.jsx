import { usePaymentsContext } from '../PaymentsContext'
import Modal from '../../Modal'
import styles from './index.module.css'
import { PAYMENT_STATUSES } from '@/lib/payment'

const PaymentModal = ({ onClose }) => {
  const { selectedPayment } = usePaymentsContext()

  if (!selectedPayment) return null

  const payment = selectedPayment.payment || selectedPayment

  return (
    <Modal title="Информация о платеже" onClose={onClose}>
      <div className={styles.infoTable}>
        <div className={styles.infoRow}>
          <span className={styles.label}>Сумма:</span>
          <span className={styles.value}>{payment.amount}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>UID:</span>
          <span className={styles.value}>{payment.uid || '—'}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Статус:</span>
          <span className={styles.value}>{PAYMENT_STATUSES[payment.status] || payment.status}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Дата:</span>
          <span className={styles.value}>{new Date(payment.createdAt).toLocaleString('ru-RU')}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>txHash:</span>
          <span className={styles.value}>{payment.txHash || '—'}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Пользователь:</span>
          <span className={styles.value}>{payment.userName || '—'}</span>
        </div>
      </div>
    </Modal>
  )
}

export default PaymentModal
