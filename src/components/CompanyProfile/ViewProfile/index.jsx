import styles from './index.module.css'
import { walletPreview } from '@/lib/wallet'

const ViewProfile = ({ company, onEdit }) => {
  return (
    <div>
      <div className={styles.row}>
        <span className={styles.label}>Название компании</span>
        <span className={styles.value}>{company?.name || '—'}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Распределительный счет компании</span>
        <span className={styles.value} title={company?.wallet || '—'}>
          {walletPreview(company?.wallet)}
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Счет на обслуживание системы (1%)</span>
        <span className={styles.value} title={company?.serviceWallet || '—'}>
          {walletPreview(company?.serviceWallet)}
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Накопительный счет</span>
        <span className={styles.value} title={company?.cumulativeWallet || '—'}>
          {walletPreview(company?.cumulativeWallet)}
        </span>
      </div>

      <button className={styles.editButton} onClick={onEdit}>
        Редактировать
      </button>
    </div>
  )
}

export default ViewProfile
