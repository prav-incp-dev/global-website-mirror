import styles from './index.module.css'

const ViewProfile = ({ profile, onEdit }) => {
  return (
    <div>
      <div className={styles.row}>
        <span className={styles.label}>Имя:</span>
        <span className={styles.value}>{profile.firstName || '—'}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Фамилия:</span>
        <span className={styles.value}>{profile.lastName || '—'}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Почта:</span>
        <span className={styles.value}>{profile.email || '—'}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Номер телефона:</span>
        <span className={styles.value}>{profile.phone || '—'}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Номер пайщика:</span>
        <span className={styles.value}>{profile.memberId || '—'}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Ник в Телеграм:</span>
        <span className={styles.value}>{profile.nick || '—'}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Кошелек:</span>
        <span className={styles.value}>{profile.wallet || '—'}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Компания:</span>
        <span className={styles.value}>{profile.companyName || '—'}</span>
      </div>
      <button className={styles.editButton} onClick={onEdit}>
        Редактировать
      </button>
    </div>
  )
}

export default ViewProfile
