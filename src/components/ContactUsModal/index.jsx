import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import Modal from '../Modal'
import CloseIcon from '@/assets/icons/CloseIcon.svg?react'
import { MAX_FILE_SIZE } from '@/lib/constants'
import styles from './index.module.css'

const ContactUsModal = ({ onClose, csrfToken }) => {
  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState('')
  const [serverError, setServerError] = useState('')
  const [sent, setSent] = useState(false)
  const fileInputRef = useRef(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      message: '',
    },
  })

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0] || null
    setFileError('')
    if (selected && selected.size > MAX_FILE_SIZE) {
      setFile(null)
      setFileError('Файл не должен превышать 1,5 МБ')
      return
    }
    setFile(selected)
  }

  const removeFile = () => {
    setFile(null)
    setFileError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const onSubmit = async ({ message }) => {
    setServerError('')

    try {
      const formData = new FormData()
      formData.append('message', message.trim())
      if (file) formData.append('attachment', file)

      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'x-csrf-token': csrfToken,
        },
        body: formData,
      })
      const data = await res.json()

      if (data.success) {
        setSent(true)
      } else {
        setServerError(data.error || 'Ошибка отправки запроса')
      }
    } catch (err) {
      setServerError(err.message || 'Что-то пошло не так. Попробуйте еще раз.')
    }
  }

  return (
    <Modal onClose={onClose} isStatic title="Связаться с нами">
      <div className={styles.body}>
        {sent ? (
          <div className={styles.success} role="status">
            Запрос отправлен. Вам ответят в ближайшее время.
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
            <p className={styles.prompt}>Оставьте свое сообщение. Мы ответим вам в ближайшее время.</p>

            <label className={styles.label} htmlFor="contact-message">
              Сообщение
            </label>
            <textarea
              id="contact-message"
              className={styles.textarea}
              rows={5}
              placeholder="Опишите ваш вопрос или обращение..."
              maxLength={2000}
              {...register('message', {
                required: 'Введите сообщение',
                validate: (value) => value.trim().length > 0 || 'Введите сообщение',
              })}
            />
            {errors.message && <span className={styles.fieldError}>{errors.message.message}</span>}

            <div className={styles.fileSection}>
              <button type="button" className={styles.fileButton} onClick={() => fileInputRef.current?.click()}>
                {file ? 'Заменить файл' : 'Прикрепить файл'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className={styles.hiddenInput}
                accept="*/*"
                onChange={handleFileChange}
              />

              {file && (
                <div className={styles.fileRow}>
                  <span className={styles.fileName}>{file.name}</span>
                  <button type="button" className={styles.removeFile} onClick={removeFile} aria-label="Удалить файл">
                    <CloseIcon />
                  </button>
                </div>
              )}
              {fileError && <p className={styles.errorText}>{fileError}</p>}
              <p className={styles.hint}>Можно прикрепить один файл размером до 1,5 МБ</p>
            </div>

            {serverError && <p className={styles.errorText}>{serverError}</p>}

            <button type="submit" className={styles.sendButton} disabled={isSubmitting}>
              {isSubmitting ? 'Отправка...' : 'Отправить'}
            </button>
          </form>
        )}
      </div>
    </Modal>
  )
}

export default ContactUsModal
