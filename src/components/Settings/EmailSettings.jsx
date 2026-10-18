import { useState } from 'react'
import styles from './settings.module.css'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const EmailSettings = ({ initial = {}, csrfToken, onFlash }) => {
  const [form, setForm] = useState({
    fromEmail: initial.fromEmail ?? '',
    fromName: initial.fromName ?? '',
    smtpHost: initial.smtpHost ?? '',
    smtpPort: initial.smtpPort ?? 587,
    smtpUser: initial.smtpUser ?? '',
    smtpPass: '',
    smtpTls: initial.smtpTls ?? true,
  })
  const [adminPassword, setAdminPassword] = useState('')
  const [reason, setReason] = useState('')
  const [testTo, setTestTo] = useState(initial.fromEmail ?? '')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const update = (name, value) => setForm((prev) => ({ ...prev, [name]: value }))

  const smtpChanged =
    form.smtpHost !== (initial.smtpHost ?? '') ||
    Number(form.smtpPort) !== Number(initial.smtpPort ?? 587) ||
    form.smtpUser !== (initial.smtpUser ?? '') ||
    Boolean(form.smtpTls) !== Boolean(initial.smtpTls ?? true) ||
    form.smtpPass.length > 0

  const handleSave = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!EMAIL_PATTERN.test(form.fromEmail)) {
      setError('Некорректный адрес отправителя')
      return
    }

    if (!EMAIL_PATTERN.test(form.smtpUser)) {
      setError('Некорректный SMTP-логин')
      return
    }

    if (smtpChanged && !adminPassword) {
      setError('Введите пароль администратора для изменения SMTP-настроек')
      return
    }

    setSaving(true)

    try {
      const response = await fetch('/api/admin/email-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          fromEmail: form.fromEmail,
          fromName: form.fromName,
          smtpHost: form.smtpHost,
          smtpPort: Number(form.smtpPort),
          smtpUser: form.smtpUser,
          ...(form.smtpPass ? { smtpPass: form.smtpPass } : {}),
          smtpTls: Boolean(form.smtpTls),
          ...(smtpChanged ? { adminPassword } : {}),
          ...(reason ? { reason } : {}),
        }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Ошибка сохранения настроек почты')

      setSuccess('Настройки почты сохранены')
      setForm((prev) => ({ ...prev, smtpPass: '' }))
      setAdminPassword('')
      setReason('')
      if (onFlash) onFlash('Настройки почты сохранены')
    } catch (err) {
      setError(err.message || 'Ошибка сохранения настроек почты')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setError('')
    setSuccess('')

    const to = testTo || form.fromEmail

    if (!EMAIL_PATTERN.test(to)) {
      setError('Некорректный адрес получателя тестового письма')
      return
    }

    setTesting(true)

    try {
      const response = await fetch('/api/admin/email/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ to }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Ошибка отправки тестового письма')

      setSuccess('Тестовое письмо отправлено')
    } catch (err) {
      setError(err.message || 'Ошибка отправки тестового письма')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className={styles.emailSection}>
      <h2 className={styles.emailTitle}>Почта</h2>
      <p className={styles.emailHint}>
        Адрес и SMTP-сервер, с которых отправляются письма: коды входа, сброс пароля, регистрация, обратная связь и
        уведомления.
      </p>

      <form onSubmit={handleSave} className={styles.fields}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Адрес отправителя</span>
          <input
            type="email"
            className={styles.input}
            value={form.fromEmail}
            onChange={(event) => update('fromEmail', event.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Имя отправителя</span>
          <input
            type="text"
            className={styles.input}
            value={form.fromName}
            onChange={(event) => update('fromName', event.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>SMTP-хост</span>
          <input
            type="text"
            className={styles.input}
            value={form.smtpHost}
            onChange={(event) => update('smtpHost', event.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>SMTP-порт</span>
          <input
            type="number"
            className={styles.input}
            value={form.smtpPort}
            onChange={(event) => update('smtpPort', event.target.value)}
            min={1}
            max={65535}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>SMTP-пользователь</span>
          <input
            type="text"
            className={styles.input}
            value={form.smtpUser}
            onChange={(event) => update('smtpUser', event.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            SMTP-пароль {initial.hasPassword ? '(уже задан — оставьте пустым, чтобы не менять)' : ''}
          </span>
          <input
            type="password"
            className={styles.input}
            value={form.smtpPass}
            onChange={(event) => update('smtpPass', event.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
          />
        </label>

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={Boolean(form.smtpTls)}
            onChange={(event) => update('smtpTls', event.target.checked)}
          />
          <span>Использовать TLS</span>
        </label>

        {smtpChanged && (
          <>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Пароль администратора для подтверждения</span>
              <input
                type="password"
                className={styles.input}
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
                autoComplete="current-password"
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Причина изменения (необязательно)</span>
              <input
                type="text"
                className={styles.input}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
              />
            </label>
          </>
        )}

        {error && <p className={styles.emailError}>{error}</p>}
        {success && <p className={styles.emailSuccess}>{success}</p>}

        <div className={styles.emailActions}>
          <button type="submit" className={styles.emailSaveButton} disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить настройки почты'}
          </button>
        </div>
      </form>

      <div className={styles.emailTestBlock}>
        <span className={styles.fieldLabel}>Тестовое письмо</span>
        <div className={styles.emailTestRow}>
          <input
            type="email"
            className={styles.input}
            value={testTo}
            onChange={(event) => setTestTo(event.target.value)}
            placeholder={form.fromEmail}
          />
          <button type="button" className={styles.emailTestButton} onClick={handleTest} disabled={testing}>
            {testing ? 'Отправка...' : 'Отправить'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default EmailSettings
