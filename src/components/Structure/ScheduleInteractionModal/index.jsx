import { useState } from 'react'
import { useForm } from 'react-hook-form'
import Modal from '../../Modal'
import { useDescendantsContext } from '../DescendantsContext'
import styles from './index.module.css'

const toLocalDatetimeString = (date) => {
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

const validateNotInPast = (value) => {
  if (new Date(value) < new Date()) {
    return 'Дата не может быть в прошлом'
  }
  return true
}

const ScheduleInteractionModal = ({ targetId, nextInteractionDate, csrfToken, onClose }) => {
  const { updateDescendantData } = useDescendantsContext()
  const [error, setError] = useState(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      plannedAt: toLocalDatetimeString(nextInteractionDate ? new Date(nextInteractionDate) : new Date()),
    },
  })

  const onSubmit = async ({ plannedAt }) => {
    setError(null)

    try {
      const res = await fetch('/api/interaction/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          plannedAt: new Date(plannedAt).toISOString(),
          targetId,
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Ошибка при сохранении')
      }

      updateDescendantData(targetId, {
        nextInteractionDate: new Date(result.interaction.plannedAt),
      })

      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Modal isOpen title="Запланировать взаимодействие" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="plannedAt">
            Дата и время планирования
          </label>
          <input
            id="plannedAt"
            className={styles.input}
            type="datetime-local"
            min={`${new Date().toLocaleDateString('en-CA')}T23:59`}
            onClick={(e) => e.target.showPicker()}
            {...register('plannedAt', {
              required: 'Обязательное поле',
              validate: validateNotInPast,
            })}
          />
          {errors.plannedAt && <span className={styles.fieldError}>{errors.plannedAt.message}</span>}
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <button className={styles.submitButton} type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Сохранение...' : 'Запланировать'}
        </button>
      </form>
    </Modal>
  )
}

export default ScheduleInteractionModal
