import { useState } from 'react'
import { useRouteContext } from '@fastify/react/client'
import Login from './components/Login'
import Confirm from './components/Confirm'
import styles from './auth.module.css'

export const getData = async ({ server, req, reply }) => {
  const user = await server.auth.getUser(req)
  if (user) return reply.redirect('/')

  const csrfToken = reply.generateCsrf()
  return { csrfToken }
}

const Auth = () => {
  const { data } = useRouteContext()
  const csrfToken = data?.csrfToken ?? ''

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('credentials')
  const [token, setToken] = useState('')
  const [info, setInfo] = useState('')

  const onLogin = async (token) => {
    setError('')
    setToken(token)
    setStep('code')
    setInfo('A 6-digit confirmation code has been sent to your email.')
    setLoading(false)
  }

  const onConfirm = async (result) => {
    window.location.assign(result.redirect)
    setLoading(false)
  }

  const onResend = async () => {
    setError('')
    setInfo('A new confirmation code has been sent to your email.')
    setLoading(false)
  }

  const onError = (message) => {
    setError(message)
    setInfo('')
    setLoading(false)
  }

  return (
    <div className={styles.container}>
      {error && <div className={styles.error}>{error}</div>}
      {info && <div className={styles.info}>{info}</div>}
      {step === 'credentials' ? (
        <Login
          csrfToken={csrfToken}
          onError={onError}
          onLoading={setLoading}
          onSuccess={onLogin}
        />
      ) : (
        <Confirm
          csrfToken={csrfToken}
          onError={onError}
          token={token}
          loading={loading}
          onLoading={setLoading}
          onConfirm={onConfirm}
          onResend={onResend}
        />
      )}
    </div>
  )
}

export default Auth
