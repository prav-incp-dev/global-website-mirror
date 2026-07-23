import { useForm } from 'react-hook-form'
import { useState } from 'react'
import styles from './index.module.css'
import ErrorIcon from '../../assets/icons/ErrorIcon.svg?react'
import InfoIcon from '../../assets/icons/InfoIcon.svg?react'

const Confirm = ({ csrfToken, token }) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { code: '' },
  })

  const [error, setError] = useState('')
  const [info, setInfo] = useState('6-значный код подтверждения отправлен на ваш электронный адрес')

  const onSubmit = async ({ code }) => {
    setError('')
    setInfo('')

    try {
      const res = await fetch('/api/auth/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ token, code }),
      })

      const result = await res.json()

      if (result.success) {
        window.location.assign(result.redirect)
      } else {
        setError(result.error || 'Неверный код или время истекло')
      }
    } catch {
      setError('Что-то пошло не так. Попробуйте еще раз.')
    }
  }

  const handleResend = async () => {
    setError('')
    setInfo('')

    try {
      const res = await fetch('/api/auth/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ token }),
      })

      const result = await res.json()

      if (result.success) {
        setInfo('Новый код подтверждения отправлен на ваш электронный адрес')
      } else {
        setError(result.error || 'Ошибка отправки кода')
      }
    } catch {
      setError('Что-то пошло не так. Попробуйте еще раз.')
    }
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Подтверждение</h1>
      {error && (
        <div className={styles.error}>
          <ErrorIcon className={styles.errorIcon} />
          <span>{error}</span>
        </div>
      )}
      {info && (
        <div className={styles.info}>
          <InfoIcon className={styles.infoIcon} />
          <span>{info}</span>
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)}>
        <input type="hidden" name="_csrf" value={csrfToken} />
        <div className={styles.formField}>
          <label htmlFor="code" className={styles.label}>
            Код подтверждения
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            className={styles.input}
            {...register('code', {
              required: 'Обязательное поле',
              pattern: {
                value: /^\d{6}$/,
                message: 'Введите 6-значный код',
              },
            })}
          />
          {errors.code && <span className={styles.fieldError}>{errors.code.message}</span>}
        </div>
        <div className={styles.formFieldLast}>
          <button
            type="submit"
            disabled={isSubmitting}
            className={styles.submitButton}
            style={{ cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
          >
            {isSubmitting ? 'Проверка' : 'Подтвердить'}
          </button>
        </div>
      </form>
      <button
        type="button"
        onClick={handleResend}
        disabled={isSubmitting}
        className={styles.resendButton}
        style={{ cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
      >
        Отправить новый код
      </button>
    </div>
  )
}

export default Confirm
