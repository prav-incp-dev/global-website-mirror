import styles from './index.module.css'

const ViewProfile = ({ company, onEdit }) => {
  return (
    <div>
      <div className={styles.row}>
        <span className={styles.label}>Название компании</span>
        <span className={styles.value}>{company?.name || '—'}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Распределительный счет</span>
        <span className={styles.value}>{company?.primaryWallet || '—'}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Накопительный счет</span>
        <span className={styles.value}>{company?.secondaryWallet || '—'}</span>
      </div>

      <button className={styles.editButton} onClick={onEdit}>
        Редактировать
      </button>
    </div>
  )
}

export default ViewProfile
