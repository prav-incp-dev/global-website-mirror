import { useState } from 'react'
import { useClientsContext } from '../ClientsContext'
import Modal from '../../Modal'
import ChangeParentModal from '../ChangeParentModal'
import styles from './index.module.css'

const ClientModal = ({ onClose }) => {
  const { selectedUser } = useClientsContext()
  const [showChangeParent, setShowChangeParent] = useState(false)

  if (!selectedUser) return null

  const parentName = () => {
    if (!selectedUser.parentId) return 'Нет родителя'

    return `${selectedUser.parent.firstName} ${selectedUser.parent.lastName || ''}`.trim()
  }

  return (
    <Modal title="Информация о пользователе" onClose={onClose}>
      {showChangeParent && <ChangeParentModal onClose={() => setShowChangeParent(false)} />}
      <div className={styles.infoTable}>
        <div className={styles.infoRow}>
          <span className={styles.label}>Имя:</span>
          <span className={styles.value}>{selectedUser.firstName}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Фамилия:</span>
          <span className={styles.value}>{selectedUser.lastName || '—'}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Статус:</span>
          <span className={styles.value}>{selectedUser.role === 'Consultant' ? 'Консультант' : 'Кандидат'}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Почта:</span>
          <span className={styles.value}>{selectedUser.email}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Номер телефона:</span>
          <span className={styles.value}>{selectedUser.phone || '—'}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Номер пайщика:</span>
          <span className={styles.value}>{selectedUser.memberId || '—'}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Ник в Телеграм:</span>
          <span className={styles.value}>{selectedUser.nick || '—'}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Уровень:</span>
          <span className={styles.value}>{selectedUser.level}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Личные продажи:</span>
          <span className={styles.value}>{selectedUser.score}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Групповые продажи:</span>
          <span className={styles.value}>{selectedUser.groupScore}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Родитель:</span>
          <span className={styles.value}>{parentName()}</span>
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.actionButton} onClick={() => setShowChangeParent(true)}>
          Изменить родителя
        </button>
        <button className={styles.actionButton} onClick={() => {}}>
          Изменить достижения
        </button>
      </div>
    </Modal>
  )
}

export default ClientModal
