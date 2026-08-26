import { useState } from 'react'
import { useClientsContext } from '../ClientsContext'
import Modal from '../../Modal'
import Stepper from '../../Stepper'
import styles from './index.module.css'

const MIN_LEVEL = 1
const MAX_LEVEL = 10
const MIN_SCORE = 0
const MAX_SCORE = 1000000

const UpdateClientModal = ({ onClose }) => {
  const { csrfToken, selectedUser, updateSelectedUser } = useClientsContext()

  const [level, setLevel] = useState(selectedUser.level)
  const [score, setScore] = useState(selectedUser.score)
  const [levelConfirmed, setLevelConfirmed] = useState(selectedUser.levelConfirmed)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isChanged = () => {
    return (
      level !== selectedUser.level || score !== selectedUser.score || levelConfirmed !== selectedUser.levelConfirmed
    )
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')

    try {
      const payload = {
        userId: selectedUser.id,
        level: level,
        score: score,
        levelConfirmed: levelConfirmed,
      }

      const res = await fetch('/api/admin/user', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Ошибка сохранения')
        return
      }

      const result = await res.json()
      if (result.success) updateSelectedUser(result.user)
      onClose()
    } catch {
      setError('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  if (!selectedUser) return null

  return (
    <Modal title="Установить достижения" isStatic onClose={onClose}>
      <div className={styles.container}>
        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Личные продажи (score)</label>
          <input
            type="number"
            className={styles.input}
            value={score}
            onChange={(e) => setScore(Math.min(MAX_SCORE, Math.max(MIN_SCORE, Number(e.target.value))))}
            min={MIN_SCORE}
            max={MAX_SCORE}
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Уровень</label>
          <Stepper min={MIN_LEVEL} max={MAX_LEVEL} value={level} onChange={setLevel} />
        </div>

        <div className={styles.checkboxRow}>
          <input
            type="checkbox"
            id="levelConfirmed"
            className={styles.checkbox}
            checked={levelConfirmed}
            onChange={(e) => setLevelConfirmed(e.target.checked)}
          />
          <label htmlFor="levelConfirmed" className={styles.checkboxLabel}>
            Уровень подтвержден
          </label>
        </div>

        <button className={styles.saveButton} onClick={handleSave} disabled={!isChanged() || saving}>
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </Modal>
  )
}

export default UpdateClientModal
