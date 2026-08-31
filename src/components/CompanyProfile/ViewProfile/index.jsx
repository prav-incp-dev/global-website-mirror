import styles from './index.module.css'

const ViewProfile = ({ company, onEdit }) => {
  const walletPreview = (wallet) => {
    if (!wallet) return '—'

    return `${wallet.slice(0, 10)}...${wallet.slice(-8)}`
  }

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

      <button className={styles.editButton} onClick={onEdit}>
        Редактировать
      </button>
    </div>
  )
}

export default ViewProfile
