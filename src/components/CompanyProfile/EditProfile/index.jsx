import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { WALLET_REGEXP } from '@/lib/regexps.js'
import styles from './index.module.css'
import ErrorIcon from '@/assets/icons/ErrorIcon.svg?react'

const EditProfile = ({ company, csrfToken, onUpdate, onCancel }) => {
  const [error, setError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: company?.name || '',
      primaryWallet: company?.primaryWallet || '',
      secondaryWallet: company?.secondaryWallet || '',
    },
  })

  const onSubmit = async (formData) => {
    setError('')

    try {
      const res = await fetch('/api/admin/company', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify(formData),
      })

      const result = await res.json()

      if (result.success) onUpdate(result.company)
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
          <label htmlFor="name" className={styles.label}>
            Название компании
          </label>
          <input
            id="name"
            type="text"
            className={styles.input}
            {...register('name', {
              required: 'Обязательное поле',
            })}
          />
          {errors.name && <span className={styles.fieldError}>{errors.name.message}</span>}
        </div>

        <div className={styles.formField}>
          <label htmlFor="primaryWallet" className={styles.label}>
            Распределительный счет
          </label>
          <input
            id="primaryWallet"
            type="text"
            placeholder="0x..."
            className={styles.input}
            {...register('primaryWallet', {
              pattern: {
                value: WALLET_REGEXP,
                message: 'Неверный формат кошелька',
              },
            })}
          />
          {errors.primaryWallet && <span className={styles.fieldError}>{errors.primaryWallet.message}</span>}
        </div>

        <div className={styles.formFieldLast}>
          <label htmlFor="secondaryWallet" className={styles.label}>
            Накопительный счет
          </label>
          <input
            id="secondaryWallet"
            type="text"
            placeholder="0x..."
            className={styles.input}
            {...register('secondaryWallet', {
              pattern: {
                value: WALLET_REGEXP,
                message: 'Неверный формат кошелька',
              },
            })}
          />
          {errors.secondaryWallet && <span className={styles.fieldError}>{errors.secondaryWallet.message}</span>}
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
