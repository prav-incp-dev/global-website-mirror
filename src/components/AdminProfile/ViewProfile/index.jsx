import styles from './index.module.css'

const ViewProfile = ({ profile, onEdit }) => {
  return (
    <div>
      <div className={styles.row}>
        <span className={styles.label}>Имя</span>
        <span className={styles.value}>{profile?.firstName || '—'}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Фамилия</span>
        <span className={styles.value}>{profile?.lastName || '—'}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Почта</span>
        <span className={styles.value}>{profile?.email || '—'}</span>
      </div>

      <button className={styles.editButton} onClick={onEdit}>
        Редактировать
      </button>
    </div>
  )
}

export default ViewProfile
