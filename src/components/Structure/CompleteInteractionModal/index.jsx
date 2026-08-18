import { useState } from 'react'
import { useForm } from 'react-hook-form'
import Modal from '../../Modal'
import { useDescendantsContext } from '../DescendantsContext'
import styles from './index.module.css'

const CompleteInteractionModal = ({ targetId, lastInteractionDate, csrfToken, onClose }) => {
  const { updateDescendantData } = useDescendantsContext()
  const [error, setError] = useState(null)

  const toLocalDatetimeString = (date) => {
    const offset = date.getTimezoneOffset()
    const local = new Date(date.getTime() - offset * 60000)
    return local.toISOString().slice(0, 16)
  }

  const validateCompletionDate = (value) => {
    if (new Date(value) > new Date()) {
      return 'Дата не может быть в будущем'
    }
    if (new Date(value) < new Date(lastInteractionDate)) {
      return 'Дата не может меньше даты последнего взаимодействия'
    }
    return true
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      completedAt: toLocalDatetimeString(new Date()),
      description: '',
    },
  })

  const onSubmit = async ({ completedAt, description }) => {
    setError(null)

    try {
      const res = await fetch('/api/interaction/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          completedAt: new Date(completedAt).toISOString(),
          description,
          targetId,
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Ошибка при сохранении')
      }

      updateDescendantData(targetId, {
        lastInteractionDate: new Date(result.interaction.completedAt),
        nextInteractionDate: null,
      })

      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Modal isOpen title="Отметить взаимодействие" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="completedAt">
            Дата и время
          </label>
          <input
            id="completedAt"
            className={styles.input}
            type="datetime-local"
            max={`${new Date().toLocaleDateString('en-CA')}T23:59`}
            onClick={(e) => e.target.showPicker()}
            {...register('completedAt', {
              required: 'Обязательное поле',
              validate: validateCompletionDate,
            })}
          />
          {errors.completedAt && <span className={styles.fieldError}>{errors.completedAt.message}</span>}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="description">
            Описание
          </label>
          <textarea
            id="description"
            className={styles.textarea}
            placeholder="Опишите результат взаимодействия..."
            rows={4}
            {...register('description', { required: 'Обязательное поле' })}
          />
          {errors.description && <span className={styles.fieldError}>{errors.description.message}</span>}
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <button className={styles.submitButton} type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Сохранение...' : 'Продолжить'}
        </button>
      </form>
    </Modal>
  )
}

export default CompleteInteractionModal
