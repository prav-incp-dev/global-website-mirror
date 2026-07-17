import { useForm } from 'react-hook-form'
import styles from './Confirm.module.css'

const Confirm = ({
  csrfToken,
  token,
  loading,
  onLoading,
  onError,
  onConfirm,
  onResend,
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: { code: '' },
  })

  const onSubmit = async ({ code }) => {
    onLoading(true)
    onError('')

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
        onConfirm(result)
      } else {
        onError(result.error || 'Confirmation failed')
      }
    } catch {
      onError('Something went wrong. Please try again.')
    }
  }

  const handleResend = async () => {
    onLoading(true)
    onError('')

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
        onResend('A new confirmation code has been sent to your email.')
      } else {
        onError(result.error || 'Failed to resend code')
      }
    } catch {
      onError('Something went wrong. Please try again.')
    }
  }

  return (
    <div className={styles.container}>
      <h1>OurHouse MLM — Confirm</h1>
      <form onSubmit={handleSubmit(onSubmit)}>
        <input type="hidden" name="_csrf" value={csrfToken} />
        <div className={styles.formField}>
          <label htmlFor="code" className={styles.label}>
            Confirmation Code
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            className={styles.input}
            {...register('code', {
              required: 'Confirmation code is required',
              pattern: {
                value: /^\d{6}$/,
                message: 'Enter the 6-digit code',
              },
            })}
          />
          {errors.code && (
            <span className={styles.fieldError}>{errors.code.message}</span>
          )}
        </div>
        <div className={styles.formFieldLast}>
          <button
            type="submit"
            disabled={loading}
            className={styles.submitButton}
            style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Verifying…' : 'Confirm'}
          </button>
        </div>
      </form>
      <button
        type="button"
        onClick={onResend}
        disabled={loading}
        className={styles.resendButton}
        style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
      >
        Resend code
      </button>
    </div>
  )
}

export default Confirm
