import { useForm } from 'react-hook-form'
import { useState } from 'react'
import styles from './Login.module.css'

const Login = ({ csrfToken, onSuccess }) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { email: '', password: '' },
  })

  const [error, setError] = useState('')
  
  const onSubmit = async ({ email, password }) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ email, password }),
      })

      const result = await res.json()

      if (result.success) {
        onSuccess(result.token)
      } else {
        setError(result.error || 'Ошибка входа в систему')
      }
    } catch {
      setError('Что-то пошло не так. Попробуйте еще раз.')
    }
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Вход в систему</h1>
      {error && <div className={styles.error}>{error}</div>}
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
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Введите корректный адрес',
              },
            })}
          />
          {errors.email && (
            <span className={styles.fieldError}>{errors.email.message}</span>
          )}
        </div>
        <div className={styles.formFieldLast}>
          <label htmlFor="password" className={styles.label}>
            Пароль
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
          {errors.password && (
            <span className={styles.fieldError}>{errors.password.message}</span>
          )}
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className={styles.submitButton}
          style={{ cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
        >
          {isSubmitting ? 'Выполняется вход…' : 'Войти'}
        </button>
      </form>
    </div>
  )
}

export default Login
