import { useState, useRef, useEffect } from 'react'
import classNames from 'classnames'
import { useRouteContext } from '@fastify/react/client'
import { useNavigate } from 'react-router'
import { UserRole } from '@/generated/prisma/enums'
import GeneralSettings from '@/components/Settings/GeneralSettings'
import LevelSettings from '@/components/Settings/LevelSettings'
import PriceSettings from '@/components/Settings/PriceSettings'
import styles from './index.module.css'

const SCREENS = [
  { key: 'general', label: 'Общие настройки' },
  { key: 'levels', label: 'Настройки уровней' },
  { key: 'prices', label: 'Настройки стоимостей' },
]

export const getData = async ({ server, req, reply }) => {
  const user = await server.auth.getUser(req)
  if (!user) return reply.redirect('/auth')
  if (user.role !== UserRole.Admin) return reply.redirect('/')

  const csrfToken = reply.generateCsrf()
  const setting = await server.admin.getSetting(user)

  return { setting, csrfToken }
}

const AdminSettings = () => {
  const { data } = useRouteContext()
  const { setting = null, csrfToken = '' } = data
  const navigate = useNavigate()

  const [activeScreen, setActiveScreen] = useState('general')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [flash, setFlash] = useState('')
  const flashTimer = useRef(null)

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current)
    }
  }, [])

  const showFlash = (message) => {
    if (flashTimer.current) clearTimeout(flashTimer.current)
    setFlash(message)
    flashTimer.current = setTimeout(() => {
      setFlash('')
      flashTimer.current = null
    }, 2500)
  }

  const [generalForm, setGeneralForm] = useState({
    staleDays: setting?.general?.staleDays ?? 0,
    orphantDays: setting?.general?.orphantDays ?? 0,
    refundFee: setting?.general?.refundFee ?? 0,
  })

  const [levelsForm, setLevelsForm] = useState(
    () =>
      setting?.levels ??
      Object.fromEntries(
        Array.from({ length: 10 }, (_, i) => [i + 1, { percent: 0, plan: 0, confirm: 0 }]),
      ),
  )

  const [pricesForm, setPricesForm] = useState(
    () =>
      setting?.prices ??
      Object.fromEntries(Array.from({ length: 6 }, (_, i) => [i, 0])),
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const data =
      activeScreen === 'general' ? generalForm
      : activeScreen === 'levels' ? levelsForm
      : pricesForm

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ type: activeScreen, data }),
      })

      const result = await res.json()
      if (!res.ok) {
        setError(result.error || 'Ошибка сохранения')
        return
      }

      showFlash('Настройки сохранены')
      setError(null)
    } catch {
      setError('Ошибка сети')
    } finally {
      setSaving(false)
    }
  }

  const updateLevel = (level, field, value) => {
    setLevelsForm((prev) => ({
      ...prev,
      [level]: { ...prev[level], [field]: value },
    }))
  }

  const updatePrice = (tier, value) => {
    setPricesForm((prev) => ({ ...prev, [tier]: value }))
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.headerTitle}>Настройки</h1>
        <button className={styles.backButton} onClick={() => navigate('/admin')}>
          Вернуться на профиль
        </button>
      </div>

      <div className={styles.screenTabs}>
        {SCREENS.map((screen) => (
          <button
            key={screen.key}
            className={classNames(styles.screenTab, {
              [styles.screenTabActive]: activeScreen === screen.key,
            })}
            onClick={() => setActiveScreen(screen.key)}
          >
            {screen.label}
          </button>
        ))}
      </div>

      {flash && <div className={styles.flash}>{flash}</div>}

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.content}>
        <form onSubmit={handleSubmit}>
          {activeScreen === 'general' && (
            <GeneralSettings
              form={generalForm}
              onChange={(name, value) => setGeneralForm((prev) => ({ ...prev, [name]: value }))}
            />
          )}

          {activeScreen === 'levels' && (
            <LevelSettings
              form={levelsForm}
              onChange={({ level, name, value }) => updateLevel(level, name, value)}
            />
          )}

          {activeScreen === 'prices' && (
            <PriceSettings
              form={pricesForm}
              onChange={(tier, value) => updatePrice(tier, value)}
            />
          )}
          <button type="submit" className={styles.saveButton} disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default AdminSettings
