import styles from './index.module.css'

const ViewProfile = ({ profile, onEdit }) => {
  const getParent = () => {
    const parent = profile.parent
    if (!parent) return null

    return parent.nick || `${parent.firstName} ${parent.lastName}`
  }
  const parent = getParent()

  const walletPreview = () => {
    if (!profile.wallet) return '-'

    return `${profile.wallet.slice(0, 10)}...${profile.wallet.slice(-8)}`
  }

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
        <span className={`${styles.value} ${styles.wallet}`} title={profile.wallet || '-'}>
          {walletPreview()}
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Компания:</span>
        <span className={styles.value}>{profile.companyName || '—'}</span>
      </div>
      {!!parent && (
        <div className={styles.row}>
          <span className={styles.label}>Ваш пригласитель:</span>
          <span className={styles.value}>{parent}</span>
        </div>
      )}
      <button className={styles.editButton} onClick={onEdit}>
        Редактировать
      </button>
    </div>
  )
}

export default ViewProfile
