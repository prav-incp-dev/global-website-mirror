import { useState } from 'react'
import { useClientsContext } from '../ClientsContext'
import Modal from '../../Modal'
import UpdateParentModal from '../UpdateParentModal'
import UpdateScoresModal from '../UpdateScoresModal'
import UpdateLevelModal from '../UpdateLevelModal'
import { UserRole } from '@/generated/prisma/enums'
import { userName } from '@/lib/user'
import styles from './index.module.css'

const ClientModal = ({ onClose }) => {
  const { selectedUser } = useClientsContext()
  const [showChangeParent, setShowChangeParent] = useState(false)
  const [showUpdateScores, setShowUpdateScores] = useState(false)
  const [showUpdateLevel, setShowUpdateLevel] = useState(false)

  if (!selectedUser) return null

  const isConsultant = selectedUser.role === UserRole.Consultant

  const parentName = () => {
    if (!selectedUser.parentId) return 'Нет родителя'

    return userName(selectedUser.parent)
  }

  return (
    <Modal title="Информация о пользователе" onClose={onClose}>
      {showChangeParent && <UpdateParentModal onClose={() => setShowChangeParent(false)} />}
      {showUpdateScores && <UpdateScoresModal onClose={() => setShowUpdateScores(false)} />}
      {showUpdateLevel && <UpdateLevelModal onClose={() => setShowUpdateLevel(false)} />}
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
          <span className={styles.value}>{isConsultant ? 'Консультант' : 'Кандидат'}</span>
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
        {isConsultant && (
          <>
            <div className={styles.infoRow}>
              <span className={styles.label}>Уровень:</span>
              <span className={styles.value}>{selectedUser.level}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>Уровень подтвержден:</span>
              <span className={styles.value}>{selectedUser.levelConfirmed ? 'Да' : 'Нет'}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>Личные продажи:</span>
              <span className={styles.value}>{selectedUser.score}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>Групповые продажи:</span>
              <span className={styles.value}>{selectedUser.groupScore}</span>
            </div>
          </>
        )}
        <div className={styles.infoRow}>
          <span className={styles.label}>Родитель:</span>
          <span className={styles.value}>{parentName()}</span>
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.actionButton} onClick={() => setShowChangeParent(true)}>
          Изменить родителя
        </button>
        {isConsultant && (
          <>
            <button className={styles.actionButton} onClick={() => setShowUpdateScores(true)}>
              Изменить единицы
            </button>
            <button className={styles.actionButton} onClick={() => setShowUpdateLevel(true)}>
              Изменить уровень
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}

export default ClientModal
