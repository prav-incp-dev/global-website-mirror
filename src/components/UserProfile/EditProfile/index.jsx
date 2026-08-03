import { useState } from 'react'
import { useForm } from 'react-hook-form'
import styles from './index.module.css'
import ErrorIcon from '@/assets/icons/ErrorIcon.svg?react'
import { PHONE_REGEXP, WALLET_REGEXP, MEMBER_REGEXP } from '@/lib/regexps.js'

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
      phone: profile?.phone || '',
      memberId: profile?.memberId || '',
      nick: profile?.nick || '',
      wallet: profile?.wallet || '',
    },
  })

  const onSubmit = async (formData) => {
    setError('')

    const trimmedData = Object.fromEntries(
      Object.entries(formData).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])
    )

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify(trimmedData),
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

        <div className={styles.formField}>
          <label htmlFor="phone" className={styles.label}>
            Номер телефона
          </label>
          <input
            type="tel"
            id="phone"
            className={styles.input}
            {...register('phone', {
              required: 'Обязательное поле',
              pattern: {
                value: PHONE_REGEXP,
                message: 'Введите корректный номер телефона',
              },
            })}
          />
          {errors.phone && <span className={styles.fieldError}>{errors.phone.message}</span>}
        </div>

        <div className={styles.formField}>
          <label htmlFor="memberId" className={styles.label}>
            Номер пайщика
          </label>
          <input
            type="text"
            id="memberId"
            placeholder="DOM-XXXXXXXX-XXXX"
            className={styles.input}
            {...register('memberId', {
              required: 'Обязательное поле',
              pattern: {
                value: MEMBER_REGEXP,
                message: 'Введите корректный номер пайщика',
              },
            })}
          />
          {errors.memberId && <span className={styles.fieldError}>{errors.memberId.message}</span>}
        </div>

        <div className={styles.formField}>
          <label htmlFor="nick" className={styles.label}>
            Ник в Телеграм
          </label>
          <input type="text" id="nick" className={styles.input} placeholder="@..." {...register('nick')} />
          {errors.nick && <span className={styles.fieldError}>{errors.nick.message}</span>}
        </div>

        <div className={styles.formField}>
          <label htmlFor="primaryWallet" className={styles.label}>
            Номер кошелька в сети BNB
          </label>
          <input
            id="wallet"
            type="text"
            placeholder="0x..."
            className={styles.input}
            {...register('wallet', {
              pattern: {
                value: WALLET_REGEXP,
                message: 'Неверный формат кошелька',
              },
            })}
          />
          {errors.wallet && <span className={styles.fieldError}>{errors.wallet.message}</span>}
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
