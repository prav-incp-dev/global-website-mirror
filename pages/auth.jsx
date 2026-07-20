import { useState } from 'react'
import { useRouteContext } from '@fastify/react/client'
import Login from '../src/components/Login'
import Confirm from '../src/components/Confirm'
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

  const [step, setStep] = useState('credentials')
  const [token, setToken] = useState('')

  const onLogin = async (token) => {
    setToken(token)
    setStep('code')
  }

  return (
    <div className={styles.container}>
      {step === 'credentials' ? (
        <Login csrfToken={csrfToken} onSuccess={onLogin} />
      ) : (
        <Confirm csrfToken={csrfToken} token={token} />
      )}
    </div>
  )
}

export default Auth
