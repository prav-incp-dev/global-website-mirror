import { useRouteContext } from '@fastify/react/client'
import { useForm } from 'react-hook-form'
import { useState } from 'react'
import { Link } from 'react-router'
import { EMAIL_REGEXP } from '@/lib/regexps.js'
import styles from './index.module.css'
import ErrorIcon from '@/assets/icons/ErrorIcon.svg?react'
import InfoIcon from '@/assets/icons/InfoIcon.svg?react'

export const getData = async ({ server, req, reply }) => {
  const user = await server.auth.getUser(req)
  if (user) return reply.redirect('/home')

  return { csrfToken: reply.generateCsrf() }
}

const ForgotPassword = () => {
  const { data } = useRouteContext()
  const { csrfToken = '' } = data

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { email: '' },
  })

  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const onSubmit = async ({ email }) => {
    setError('')

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ email: email.trim() }),
      })

      const result = await res.json()

      if (result.success) {
        setSuccess(true)
      } else {
        setError(result.error || 'Ошибка отправки письма')
      }
    } catch {
      setError('Что-то пошло не так. Попробуйте еще раз.')
    }
  }

  if (success) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.container}>
          <h1 className={styles.title}>Забыли пароль?</h1>
          <div className={styles.info}>
            <InfoIcon className={styles.infoIcon} />
            <span>Ссылка для сброса пароля отправлена на ваш email. Проверьте почту и перейдите по ссылке.</span>
          </div>
          <Link to="/auth" className={styles.backButton}>
            Вернуться ко входу
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <h1 className={styles.title}>Забыли пароль?</h1>
        <p className={styles.description}>Укажите ваш email и мы отправим вам ссылку для сброса пароля</p>
        {error && (
          <div className={styles.error}>
            <ErrorIcon className={styles.errorIcon} />
            <span>{error}</span>
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)}>
          <input type="hidden" name="_csrf" value={csrfToken} />
          <div className={styles.formField}>
            <label htmlFor="email" className={styles.label}>
              Электронная почта
            </label>
            <input
              id="email"
              type="email"
              className={styles.input}
              {...register('email', {
                required: 'Обязательное поле',
                pattern: {
                  value: EMAIL_REGEXP,
                  message: 'Введите корректный адрес',
                },
              })}
            />
            {errors.email && <span className={styles.fieldError}>{errors.email.message}</span>}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className={styles.submitButton}
            style={{ cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
          >
            {isSubmitting ? 'Отправка…' : 'Отправить ссылку'}
          </button>
        </form>
        <Link to="/auth" className={styles.backButton}>
          Вернуться ко входу
        </Link>
      </div>
    </div>
  )
}

export default ForgotPassword
