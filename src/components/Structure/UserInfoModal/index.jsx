import CloseIcon from '@/assets/icons/CloseIcon.svg?react'
import styles from './index.module.css'

const UserInfoModal = ({ data, onClose }) => {
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Информация о пользователе</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Закрыть">
            <CloseIcon />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.infoTable}>
            <div className={styles.infoRow}>
              <span className={styles.label}>Имя:</span>
              <span className={styles.value}>{data.firstName}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>Фамилия:</span>
              <span className={styles.value}>{data.lastName || '—'}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>Статус:</span>
              <span className={styles.value}>{data.status || '—'}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>Почта:</span>
              <span className={styles.value}>{data.email}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>Номер телефона:</span>
              <span className={styles.value}>{data.phoneNumber || '—'}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>Номер пайщика:</span>
              <span className={styles.value}>{data.memberId || '—'}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>Ник в Телеграм:</span>
              <span className={styles.value}>{data.nick || '—'}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>Уровень:</span>
              <span className={styles.value}>{data.level}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>Личные продажи</span>
              <span className={styles.value}>{data.score}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>Групповые продажи:</span>
              <span className={styles.value}>{data.groupScore}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>Дата последнего взаимодействия:</span>
              <span className={styles.value}>{data.lastInteractionDate?.toLocaleDateString('ru-RU') || '—'}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>Дата запланированного взаимодействия:</span>
              <span className={styles.value}>{data.nextInteractionDate?.toLocaleDateString('ru-RU') || '—'}</span>
            </div>
          </div>

          <div className={styles.actions}>
            <button className={styles.markButton} onClick={() => {}}>
              Отметить взаимодействие
            </button>
            <button className={styles.scheduleButton} onClick={() => {}}>
              Запланировать взаимодействие
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UserInfoModal
