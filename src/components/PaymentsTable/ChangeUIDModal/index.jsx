import { useState } from 'react'
import { useForm } from 'react-hook-form'
import Modal from '../../Modal'
import { usePaymentsContext } from '../PaymentsContext'
import { UID_REGEXP } from '@/lib/regexps'
import styles from './index.module.css'

const ChangeUIDModal = ({ onClose }) => {
  const { csrfToken, selectedPayment, updateSelectedPayment, fetchPayments } = usePaymentsContext()
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      uid: selectedPayment?.uid || '',
    },
  })

  if (!selectedPayment) return null

  const onSubmit = async ({ uid }) => {
    setServerError('')

    try {
      const res = await fetch(`/api/admin/payments/${selectedPayment.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ uid: uid.trim() }),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error)

      if (result.success) {
        updateSelectedPayment({ id: selectedPayment.id, uid: uid.trim() })
        await fetchPayments()
      }
      onClose()
    } catch (err) {
      setServerError(err.message || 'Ошибка сохранения')
    }
  }

  return (
    <Modal title="Изменить номер платежа" isStatic onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className={styles.container}>
          {serverError && <div className={styles.error}>{serverError}</div>}
          <div className={styles.fieldGroup}>
            <label htmlFor="uid" className={styles.label}>
              Номер платежа (ON-XXXX-XX)
            </label>
            <input
              id="uid"
              type="text"
              className={styles.input}
              placeholder="ON-XXXX-XX"
              {...register('uid', {
                required: 'Обязательное поле',
                pattern: {
                  value: UID_REGEXP,
                  message: 'Введите корректный номер платежа',
                },
              })}
            />
            {errors.uid && <span className={styles.fieldError}>{errors.uid.message}</span>}
          </div>
          <button className={styles.saveButton} type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default ChangeUIDModal
