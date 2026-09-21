import { useState, useRef, useEffect } from 'react'
import classNames from 'classnames'
import { useClientsContext } from '../ClientsContext'
import Modal from '../../Modal'
import UpdateParentModal from '../UpdateParentModal'
import UpdateScoresModal from '../UpdateScoresModal'
import UpdateLevelModal from '../UpdateLevelModal'
import AddWageModal from '../AddWageModal'
import { UserRole } from '@/generated/prisma/enums'
import { userName } from '@/lib/user'
import { walletPreview } from '@/lib/wallet'
import styles from './index.module.css'

const TAB_GENERAL = 'general'
const TAB_ACHIEVEMENTS = 'achievements'

const ClientModal = ({ onClose }) => {
  const { selectedUser } = useClientsContext()
  const [activeTab, setActiveTab] = useState(TAB_GENERAL)
  const [showChangeParent, setShowChangeParent] = useState(false)
  const [showUpdateScores, setShowUpdateScores] = useState(false)
  const [showUpdateLevel, setShowUpdateLevel] = useState(false)
  const [showAddWage, setShowAddWage] = useState(false)
  const [notification, setNotification] = useState('')
  const notificationTimer = useRef(null)

  useEffect(() => {
    return () => {
      if (notificationTimer.current) clearTimeout(notificationTimer.current)
    }
  }, [])

  if (!selectedUser) return null

  const isConsultant = selectedUser.role === UserRole.Consultant

  const parentName = () => {
    if (!selectedUser.parentId) return 'Нет родителя'

    return userName(selectedUser.parent)
  }

  const handleWageSuccess = () => {
    setShowAddWage(false)

    if (notificationTimer.current) clearTimeout(notificationTimer.current)
    setNotification('Начисление успешно добавлено')
    notificationTimer.current = setTimeout(() => {
      setNotification('')
      notificationTimer.current = null
    }, 2500)
  }

  return (
    <Modal title="Информация о пользователе" onClose={onClose}>
      {showChangeParent && <UpdateParentModal onClose={() => setShowChangeParent(false)} />}
      {showUpdateScores && <UpdateScoresModal onClose={() => setShowUpdateScores(false)} />}
      {showUpdateLevel && <UpdateLevelModal onClose={() => setShowUpdateLevel(false)} />}
      {showAddWage && <AddWageModal onClose={() => setShowAddWage(false)} onSuccess={handleWageSuccess} />}
      {notification && (
        <div className={styles.notification}>{notification}</div>
      )}
      {isConsultant && (
        <div className={styles.tabs}>
          <button
            className={classNames(styles.tab, { [styles.tabActive]: activeTab === TAB_GENERAL })}
            onClick={() => setActiveTab(TAB_GENERAL)}
          >
            Общая информация
          </button>
          <button
            className={classNames(styles.tab, { [styles.tabActive]: activeTab === TAB_ACHIEVEMENTS })}
            onClick={() => setActiveTab(TAB_ACHIEVEMENTS)}
          >
            Достижения
          </button>
        </div>
      )}

      {activeTab === TAB_GENERAL && (
        <>
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
            <div className={styles.infoRow}>
              <span className={styles.label}>Родитель:</span>
              <span className={styles.value}>{parentName()}</span>
            </div>
          </div>

          <div className={styles.actions}>
            <button className={styles.actionButton} onClick={() => setShowChangeParent(true)}>
              Изменить родителя
            </button>
          </div>
        </>
      )}

      {activeTab === TAB_ACHIEVEMENTS && isConsultant && (
        <>
          <div className={styles.infoTable}>
            <div className={styles.infoRow}>
              <span className={styles.label}>Уровень:</span>
              <span className={styles.value}>{selectedUser.level}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>Уровень подтвержден:</span>
              <span className={styles.value}>{selectedUser.levelConfirmed ? 'Да' : 'Нет'}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>Личные единицы:</span>
              <span className={styles.value}>{selectedUser.score}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>Групповые единицы:</span>
              <span className={styles.value}>{selectedUser.groupScore}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>Кошелек:</span>
              <span className={styles.value}>{walletPreview(selectedUser.wallet)}</span>
            </div>
          </div>

          <div className={styles.actions}>
            {!selectedUser.isLocked && (
              <>
                <button className={styles.actionButton} onClick={() => setShowUpdateScores(true)}>
                  Изменить единицы
                </button>
                <button className={styles.actionButton} onClick={() => setShowUpdateLevel(true)}>
                  Изменить уровень
                </button>
              </>
            )}
            <button className={styles.actionButton} onClick={() => setShowAddWage(true)}>
              Добавить начисление
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

export default ClientModal
