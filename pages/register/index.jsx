import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useRouteContext } from '@fastify/react/client'
import { PHONE_REGEXP } from '../../src/lib/regexps.js'
import styles from './index.module.css'

// Fastify preHandler hook runs before getData is called
export const preHandler = [
  async (req, reply) => {
    const user = await req.server.auth.getUser(req)
    if (user) return reply.redirect('/')

    const { token } = req.query

    try {
      await req.server.registration.verifyToken(token)
    } catch {
      return reply.redirect('/auth')
    }
  },
]

export const getData = async ({ req, reply }) => {
  return {
    csrfToken: reply.generateCsrf(),
    token: req.query.token,
  }
}

const Register = () => {
  const { data } = useRouteContext()
  const { csrfToken = '', token = '' } = data

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      email: '',
      nick: '',
      fullName: '',
      phone: '',
      memberId: '',
      password: '',
      confirmPassword: '',
    },
  })

  const handleRegister = async (formData) => {
    setError('')

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          email: formData.email,
          nick: formData.nick,
          fullName: formData.fullName,
          phone: formData.phone,
          memberId: formData.memberId,
          password: formData.password,
          token,
        }),
      })
      const result = await response.json()

      if (result.success) {
        setSuccess('Регистрация прошла успешно. Сейчас можно будет войти в систему...')
        setTimeout(() => {
          window.location.assign('/auth')
        }, 5000)
      } else {
        setError(result.error || 'Ошибка регистрации')
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

  return (
    <div className={styles.container}>
      <h1>Регистрация</h1>
      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}
      <form onSubmit={handleSubmit(handleRegister)}>
        <input type="hidden" name="_csrf" value={csrfToken} />
        <div className={styles.formField}>
          <label htmlFor="email" className={styles.label}>
            Электронная почта
          </label>
          <input
            type="email"
            id="email"
            className={styles.input}
            {...register('email', {
              required: 'Обязательное поле',
              pattern: {
                value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                message: 'Введите корректный адрес',
              },
            })}
          />
          {errors.email && <span className={styles.fieldError}>{errors.email.message}</span>}
        </div>
        <div className={styles.formField}>
          <label htmlFor="nick" className={styles.label}>
            Ник в Телеграм
          </label>
          <input
            type="text"
            id="nick"
            className={styles.input}
            {...register('nick', {
              required: 'Обязательное поле',
            })}
          />
          {errors.nick && <span className={styles.fieldError}>{errors.nick.message}</span>}
        </div>
        <div className={styles.formField}>
          <label htmlFor="fullName" className={styles.label}>
            Фамилия и имя
          </label>
          <input
            type="text"
            id="fullName"
            className={styles.input}
            {...register('fullName', {
              required: 'Обязательное поле',
            })}
          />
          {errors.fullName && <span className={styles.fieldError}>{errors.fullName.message}</span>}
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
            className={styles.input}
            {...register('memberId', {
              required: 'Обязательное поле',
            })}
          />
          {errors.memberId && <span className={styles.fieldError}>{errors.memberId.message}</span>}
        </div>
        <div className={styles.formField}>
          <label htmlFor="password" className={styles.label}>
            Пароль
          </label>
          <input
            type="password"
            id="password"
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
        <div className={styles.formFieldLast}>
          <label htmlFor="confirmPassword" className={styles.label}>
            Подтверждение пароля
          </label>
          <input
            type="password"
            id="confirmPassword"
            className={styles.input}
            {...register('confirmPassword', {
              required: 'Обязательное поле',
              validate: (value) => value === password || 'Пароли не совпадают',
            })}
          />
          {errors.confirmPassword && <span className={styles.fieldError}>{errors.confirmPassword.message}</span>}
        </div>
        <button type="submit" disabled={isSubmitting} className={styles.submitButton}>
          {isSubmitting ? 'Регистрация...' : 'Зарегистрироваться'}
        </button>
      </form>
    </div>
  )
}

export default Register
