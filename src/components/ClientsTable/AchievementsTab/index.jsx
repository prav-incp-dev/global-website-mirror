import { useState } from 'react'
import { useClientsContext } from '../ClientsContext'
import UpdateScoresModal from '../UpdateScoresModal'
import UpdateLevelModal from '../UpdateLevelModal'
import styles from './index.module.css'

const AchievementsTab = () => {
  const { selectedUser } = useClientsContext()
  const [showUpdateScores, setShowUpdateScores] = useState(false)
  const [showUpdateLevel, setShowUpdateLevel] = useState(false)

  return (
    <>
      {showUpdateScores && <UpdateScoresModal onClose={() => setShowUpdateScores(false)} />}
      {showUpdateLevel && <UpdateLevelModal onClose={() => setShowUpdateLevel(false)} />}

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
      </div>
    </>
  )
}

export default AchievementsTab
