import Modal from '../../Modal'
import styles from './index.module.css'

const ClientModal = ({ data, onClose }) => {
  const parentName = () => {
    if (!data.parentId) return 'Нет родителя'
    
    return `${data.parent.firstName} ${data.parent.lastName || ''}`.trim()
  }

  return (
    <Modal title="Информация о пользователе" onClose={onClose}>
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
          <span className={styles.value}>{data.role === 'Consultant' ? 'Консультант' : 'Кандидат'}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Почта:</span>
          <span className={styles.value}>{data.email}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Номер телефона:</span>
          <span className={styles.value}>{data.phone || '—'}</span>
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
          <span className={styles.label}>Личные продажи:</span>
          <span className={styles.value}>{data.score}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Групповые продажи:</span>
          <span className={styles.value}>{data.groupScore}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Родитель:</span>
          <span className={styles.value}>{parentName()}</span>
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.actionButton} onClick={() => {}}>
          Изменить родителя
        </button>
        <button className={styles.actionButton} onClick={() => {}}>
          Изменить уровень
        </button>
        <button className={styles.actionButton} onClick={() => {}}>
          Изменить количество единиц
        </button>
      </div>
    </Modal>
  )
}

export default ClientModal
