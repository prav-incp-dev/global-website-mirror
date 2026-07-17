import { useForm } from 'react-hook-form'
import styles from './Login.module.css'

const Login = ({ csrfToken, loading, onLoading, onError, onSuccess }) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async ({ email, password }) => {
    onLoading(true)

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
        onError(result.error || 'Login failed')
      }
    } catch {
      onError('Something went wrong. Please try again.')
    }
  }

  return (
    <div className={styles.container}>
      <h1>OurHouse MLM — Login</h1>
      <form onSubmit={handleSubmit(onSubmit)}>
        <input type="hidden" name="_csrf" value={csrfToken} />
        <div className={styles.formField}>
          <label htmlFor="email" className={styles.label}>
            Email
          </label>
          <input
            id="email"
            type="email"
            className={styles.input}
            {...register('email', {
              required: 'Email is required',
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Enter a valid email address',
              },
            })}
          />
          {errors.email && (
            <span className={styles.fieldError}>{errors.email.message}</span>
          )}
        </div>
        <div className={styles.formFieldLast}>
          <label htmlFor="password" className={styles.label}>
            Password
          </label>
          <input
            id="password"
            type="password"
            className={styles.input}
            {...register('password', {
              required: 'Password is required',
              minLength: {
                value: 6,
                message: 'Password must be at least 6 characters',
              },
            })}
          />
          {errors.password && (
            <span className={styles.fieldError}>{errors.password.message}</span>
          )}
        </div>
        <button
          type="submit"
          disabled={loading}
          className={styles.submitButton}
          style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'Logging in…' : 'Login'}
        </button>
      </form>
    </div>
  )
}

export default Login
