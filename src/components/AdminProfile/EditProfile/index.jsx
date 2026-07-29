import { useState } from 'react'
import { useForm } from 'react-hook-form'
import styles from './index.module.css'
import ErrorIcon from '@/assets/icons/ErrorIcon.svg?react'

const EditProfile = ({ profile, csrfToken, onUpdate, onCancel }) => {
  const [error, setError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      firstName: profile?.firstName || '',
      lastName: profile?.lastName || '',
    },
  })

  const onSubmit = async (formData) => {
    setError('')

    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify(formData),
      })

      const result = await res.json()

      if (result.success) onUpdate(result.profile)
      else setError(result.error || 'Ошибка сохранения')
    } catch {
      setError('Что-то пошло не так. Попробуйте еще раз.')
    }
  }

  return (
    <div>
      {error && (
        <div className={styles.message}>
          <ErrorIcon className={styles.messageIcon} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <input type="hidden" name="_csrf" value={csrfToken} />

        <div className={styles.formField}>
          <label htmlFor="firstName" className={styles.label}>
            Имя
          </label>
          <input
            id="firstName"
            type="text"
            className={styles.input}
            {...register('firstName', {
              required: 'Обязательное поле',
            })}
          />
          {errors.firstName && <span className={styles.fieldError}>{errors.firstName.message}</span>}
        </div>

        <div className={styles.formField}>
          <label htmlFor="lastName" className={styles.label}>
            Фамилия
          </label>
          <input
            id="lastName"
            type="text"
            className={styles.input}
            {...register('lastName', {
              required: 'Обязательное поле',
            })}
          />
          {errors.lastName && <span className={styles.fieldError}>{errors.lastName.message}</span>}
        </div>

        <div className={styles.buttonRow}>
          <button
            type="submit"
            disabled={isSubmitting}
            className={styles.submitButton}
            style={{ cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
          >
            {isSubmitting ? 'Сохранение…' : 'Сохранить'}
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            className={styles.cancelButton}
            style={{ cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
            onClick={onCancel}
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  )
}

export default EditProfile
