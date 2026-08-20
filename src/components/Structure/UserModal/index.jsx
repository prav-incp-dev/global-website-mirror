import { useState } from 'react'
import Modal from '../../Modal'
import CompleteInteractionModal from '../CompleteInteractionModal'
import ScheduleInteractionModal from '../ScheduleInteractionModal'
import styles from './index.module.css'

const UserModal = ({ data, csrfToken, currentUserId, onClose }) => {
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const isDirectChild = data.parentId === currentUserId

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
          <span className={styles.value}>{data.status || '—'}</span>
        </div>
        {isDirectChild && [
          <div className={styles.infoRow} key="email">
            <span className={styles.label}>Почта:</span>
            <span className={styles.value}>{data.email}</span>
          </div>,
          <div className={styles.infoRow} key="phoneNumber">
            <span className={styles.label}>Номер телефона:</span>
            <span className={styles.value}>{data.phoneNumber || '—'}</span>
          </div>,
          <div className={styles.infoRow} key="memberId">
            <span className={styles.label}>Номер пайщика:</span>
            <span className={styles.value}>{data.memberId || '—'}</span>
          </div>,
          <div className={styles.infoRow} key="nick">
            <span className={styles.label}>Ник в Телеграм:</span>
            <span className={styles.value}>{data.nick || '—'}</span>
          </div>,
        ]}
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
          <span className={styles.label}>Дата последнего взаимодействия:</span>
          <span className={styles.value}>{data.lastInteractionDate?.toLocaleDateString('ru-RU') || '—'}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Дата запланированного взаимодействия:</span>
          <span className={styles.value}>{data.nextInteractionDate?.toLocaleDateString('ru-RU') || '—'}</span>
        </div>
      </div>

      {isDirectChild && (
        <div className={styles.actions}>
          <button className={styles.completeButton} onClick={() => setShowCompleteModal(true)}>
            Отметить взаимодействие
          </button>
          <button className={styles.scheduleButton} onClick={() => setShowScheduleModal(true)}>
            Запланировать взаимодействие
          </button>
        </div>
      )}

      {showCompleteModal && (
        <CompleteInteractionModal
          targetId={data.id}
          lastInteractionDate={data.lastInteractionDate}
          csrfToken={csrfToken}
          onClose={() => setShowCompleteModal(false)}
        />
      )}

      {showScheduleModal && (
        <ScheduleInteractionModal
          targetId={data.id}
          nextInteractionDate={data.nextInteractionDate}
          csrfToken={csrfToken}
          onClose={() => setShowScheduleModal(false)}
        />
      )}
    </Modal>
  )
}

export default UserModal
