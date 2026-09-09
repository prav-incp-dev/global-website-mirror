import { useState } from 'react'
import { useClientsContext } from '../ClientsContext'
import Modal from '../../Modal'
import styles from './index.module.css'

const MIN_SCORE = 0
const MAX_SCORE = 1000000

const UpdateScoresModal = ({ onClose }) => {
  const { csrfToken, selectedUser, updateSelectedUser } = useClientsContext()

  const [score, setScore] = useState(selectedUser.score)
  const [groupScore, setGroupScore] = useState(selectedUser.groupScore)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isChanged = () => {
    return score !== selectedUser.score || groupScore !== selectedUser.groupScore
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')

    try {
      const payload = {
        userId: selectedUser.id,
        score,
        groupScore,
      }

      const res = await fetch('/api/admin/user/wages', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify(payload),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error)

      if (result.success) {
        updateSelectedUser({ id: selectedUser.id, score: result.score, groupScore: result.groupScore })
      }
      onClose()
    } catch (err) {
      setError(err.message || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Установить единицы" isStatic onClose={onClose}>
      <div className={styles.container}>
        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.fieldGroup}>
          <label htmlFor="score" className={styles.label}>
            Личные единицы
          </label>
          <input
            id="score"
            type="number"
            className={styles.input}
            value={score}
            onChange={(e) => setScore(Math.min(MAX_SCORE, Math.max(MIN_SCORE, Number(e.target.value))))}
            min={MIN_SCORE}
            max={MAX_SCORE}
          />
        </div>

        <div className={styles.fieldGroup}>
          <label htmlFor="groupScore" className={styles.label}>
            Групповые единицы
          </label>
          <input
            id="groupScore"
            type="number"
            className={styles.input}
            value={groupScore}
            onChange={(e) => setGroupScore(Math.min(MAX_SCORE, Math.max(MIN_SCORE, Number(e.target.value))))}
            min={MIN_SCORE}
            max={MAX_SCORE}
          />
        </div>

        <button className={styles.saveButton} onClick={handleSave} disabled={!isChanged() || saving}>
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </Modal>
  )
}

export default UpdateScoresModal
