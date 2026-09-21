import { useState } from 'react'
import { useClientsContext } from '../ClientsContext'
import Modal from '../../Modal'
import Stepper from '../../Stepper'
import { MIN_LEVEL, MAX_LEVEL } from '@/lib/constants'
import styles from './index.module.css'

const UpdateLevelModal = ({ onClose }) => {
  const { csrfToken, selectedUser, updateSelectedUser } = useClientsContext()

  const [level, setLevel] = useState(selectedUser.level)
  const [levelConfirmed, setLevelConfirmed] = useState(selectedUser.levelConfirmed)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isChanged = () => {
    return level !== selectedUser.level || levelConfirmed !== selectedUser.levelConfirmed
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')

    try {
      const payload = {
        level,
        levelConfirmed,
      }

      const res = await fetch(`/api/admin/user/${selectedUser.id}/level`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify(payload),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error)

      if (result.success) updateSelectedUser(result.user)
      onClose()
    } catch (err) {
      setError(err.message || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Установить уровень" isStatic onClose={onClose}>
      <div className={styles.container}>
        {error && <p className={styles.error}>{error}</p>}

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

export default UpdateLevelModal
