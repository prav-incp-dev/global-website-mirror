import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useRouteContext } from '@fastify/react/client'
import styles from './login.module.css'

export const getData = async ({ server, req, reply }) => {
  // If already logged in, redirect to home
  const user = await server.auth.getUser(req)
  if (user) {
    return reply.redirect('/')
  }

  // Generate CSRF token for the form
  const csrfToken = reply.generateCsrf()
  return { csrfToken }
}

const Login = () => {
  const { data } = useRouteContext()
  const csrfToken = data?.csrfToken ?? ''

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async ({ email, password }) => {
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ email, password }),
      })

      const result = await res.json()

      if (result.success) {
        window.location.assign(result.redirect)
      } else {
        setError(result.error || 'Login failed')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <h1>OurHouse MLM — Login</h1>
      {error && <div className={styles.error}>{error}</div>}
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
