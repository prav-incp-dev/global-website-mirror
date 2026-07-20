import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useRouteContext } from '@fastify/react/client'
import styles from './register.module.css'

export const getData = async ({ server, req, reply }) => {
  const user = await server.auth.getUser(req)
  if (user) return reply.redirect('/')

  const csrfToken = reply.generateCsrf()
  return { csrfToken }
}

const Register = () => {
  const { data } = useRouteContext()
  const { csrfToken = {} } = data

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
        }),
      })
      const result = await response.json()

      if (result.success) {
        setSuccess('Registration went successfully. Redirecting to login page...')
        setTimeout(() => {
          window.location.assign('/auth')
        }, 5000)
      } else {
        setError(result.error || 'Registration failed')
      }
    } catch (err) {
      setError('An error occurred during registration')
    }
  }

  const password = useWatch({
    control,
    name: 'password',
    defaultValue: '',
  })

  return (
    <div className={styles.container}>
      <h1>Register</h1>
      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}
      <form onSubmit={handleSubmit(handleRegister)}>
        <input type="hidden" name="_csrf" value={csrfToken} />
        <div className={styles.formField}>
          <label htmlFor="email" className={styles.label}>Email</label>
          <input
            type="email"
            id="email"
            className={styles.input}
            {...register('email', {
              required: 'Email is required',
              pattern: {
                value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                message: 'Invalid email format',
              },
            })}
          />
          {errors.email && <span className={styles.fieldError}>{errors.email.message}</span>}
        </div>
        <div className={styles.formField}>
          <label htmlFor="nick" className={styles.label}>Nick</label>
          <input
            type="text"
            id="nick"
            className={styles.input}
            {...register('nick', {
              required: 'Nick is required',
            })}
          />
          {errors.nick && <span className={styles.fieldError}>{errors.nick.message}</span>}
        </div>
        <div className={styles.formField}>
          <label htmlFor="fullName" className={styles.label}>Full Name</label>
          <input
            type="text"
            id="fullName"
            className={styles.input}
            {...register('fullName', {
              required: 'Full Name is required',
            })}
          />
          {errors.fullName && <span className={styles.fieldError}>{errors.fullName.message}</span>}
        </div>
        <div className={styles.formField}>
          <label htmlFor="phone" className={styles.label}>Phone Number</label>
          <input
            type="tel"
            id="phone"
            className={styles.input}
            {...register('phone', {
              required: 'Phone Number is required',
              pattern: {
                value: /^\+?[1-9]\d{1,14}$/,
                message: 'Invalid phone number format',
              },
            })}
          />
          {errors.phone && <span className={styles.fieldError}>{errors.phone.message}</span>}
        </div>
        <div className={styles.formField}>
          <label htmlFor="memberId" className={styles.label}>Member Id</label>
          <input
            type="text"
            id="memberId"
            className={styles.input}
            {...register('memberId', {
              required: 'Member Id is required',
            })}
          />
          {errors.memberId && <span className={styles.fieldError}>{errors.memberId.message}</span>}
        </div>
        <div className={styles.formField}>
          <label htmlFor="password" className={styles.label}>Password</label>
          <input
            type="password"
            id="password"
            className={styles.input}
            {...register('password', {
              required: 'Password is required',
              minLength: {
                value: 6,
                message: 'Password must be at least 6 characters',
              },
            })}
          />
          {errors.password && <span className={styles.fieldError}>{errors.password.message}</span>}
        </div>
        <div className={styles.formFieldLast}>
          <label htmlFor="confirmPassword" className={styles.label}>Confirm Password</label>
          <input
            type="password"
            id="confirmPassword"
            className={styles.input}
            {...register('confirmPassword', {
              required: 'Confirm Password is required',
              validate: (value) =>
                value === password || 'Passwords do not match',
            })}
          />
          {errors.confirmPassword && (
            <span className={styles.fieldError}>{errors.confirmPassword.message}</span>
          )}
        </div>
        <button type="submit" disabled={isSubmitting} className={styles.submitButton}>
          {isSubmitting ? 'Registering...' : 'Register'}
        </button>
      </form>
    </div>
  )
}

export default Register
