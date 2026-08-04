import { useRouteContext } from '@fastify/react/client'
import { useForm, useWatch } from 'react-hook-form'
import { useState } from 'react'
import styles from './index.module.css'
import ErrorIcon from '@/assets/icons/ErrorIcon.svg?react'
import InfoIcon from '@/assets/icons/InfoIcon.svg?react'

export const getData = async ({ server, req, reply }) => {
  const user = await server.auth.getUser(req)
  if (user) return reply.redirect('/')

  const { token } = req.query

  if (!token) {
    return reply.redirect('/auth')
  }

  return { csrfToken: reply.generateCsrf(), token }
}

const ResetPassword = () => {
  const { data } = useRouteContext()
  const { csrfToken = '', token = '' } = data

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  })

  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const onSubmit = async ({ password }) => {
    setError('')

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ token, password }),
      })

      const result = await res.json()

      if (result.success) {
        setSuccess(true)
        setTimeout(() => {
          window.location.assign('/auth')
        }, 3000)
      } else {
        setError(result.error || 'Ошибка сброса пароля')
      }
    } catch {
      setError('Что-то пошло не так. Попробуйте еще раз.')
    }
  }

  const password = useWatch({
    control,
    name: 'password',
    defaultValue: '',
  })

  if (success) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.container}>
          <h1 className={styles.title}>Новый пароль</h1>
          <div className={styles.info}>
            <InfoIcon className={styles.infoIcon} />
            <span>Пароль успешно изменён. Сейчас вы будете перенаправлены на страницу входа...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <h1 className={styles.title}>Новый пароль</h1>
        {error && (
          <div className={styles.error}>
            <ErrorIcon className={styles.errorIcon} />
            <span>{error}</span>
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)}>
          <input type="hidden" name="_csrf" value={csrfToken} />
          <div className={styles.formField}>
            <label htmlFor="password" className={styles.label}>
              Новый пароль
            </label>
            <input
              id="password"
              type="password"
              className={styles.input}
              {...register('password', {
                required: 'Обязательное поле',
                minLength: {
                  value: 6,
                  message: 'Минимум 6 символов',
                },
              })}
            />
            {errors.password && <span className={styles.fieldError}>{errors.password.message}</span>}
          </div>
          <div className={styles.formField}>
            <label htmlFor="confirmPassword" className={styles.label}>
              Подтверждение пароля
            </label>
            <input
              id="confirmPassword"
              type="password"
              className={styles.input}
              {...register('confirmPassword', {
                required: 'Обязательное поле',
                validate: (value) => value === password || 'Пароли не совпадают',
              })}
            />
            {errors.confirmPassword && <span className={styles.fieldError}>{errors.confirmPassword.message}</span>}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className={styles.submitButton}
            style={{ cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
          >
            {isSubmitting ? 'Сохранение…' : 'Сохранить пароль'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ResetPassword
