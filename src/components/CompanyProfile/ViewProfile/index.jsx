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
        <span className={styles.label}>Распределительный счет</span>
        <span className={styles.value} title={company?.primaryWallet || '—'}>
          {walletPreview(company?.primaryWallet)}
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Накопительный счет</span>
        <span className={styles.value} title={company?.secondaryWallet || '—'}>
          {walletPreview(company?.secondaryWallet)}
        </span>
      </div>

      <button className={styles.editButton} onClick={onEdit}>
        Редактировать
      </button>
    </div>
  )
}

export default ViewProfile
