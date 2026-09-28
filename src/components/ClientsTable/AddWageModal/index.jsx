import { useState, useRef, useEffect } from 'react'
import classNames from 'classnames'
import { useForm, useWatch } from 'react-hook-form'
import { getAddress, parseUnits } from 'viem'
import { useClientsContext } from '../ClientsContext'
import { getPublicClient, getWalletClient, ensureChain, usdtAddress, usdtDecimals, ERC20_ABI } from '@/lib/chain.js'
import Modal from '../../Modal'
import styles from './index.module.css'

const CONFIRMATION_TEXT = 'Вы подтверждаете, что пользователю было выполнено начисление?'

const WAGE_DESCRIPTIONS = ['Лидерское вознаграждение', 'На офис', 'На путешествие']

const AddWageModal = ({ onClose, onSuccess }) => {
  const { csrfToken, selectedUser, companyWallet } = useClientsContext()

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isValid },
  } = useForm({
    defaultValues: {
      amount: 0,
      description: '',
    },
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loaderText, setLoaderText] = useState('')
  const [descriptionOpen, setDescriptionOpen] = useState(false)
  const descriptionWrapRef = useRef(null)

  const [amount, description] = useWatch({ control, name: ['amount', 'description'] })
  const canTransfer = amount > 0 && isValid
  const canCredit = isValid

  const handleSelectDescription = (value) => {
    setValue('description', value, { shouldValidate: true })
    setDescriptionOpen(false)
  }

  // Suggestions filtered by what the admin has already typed (or all presets when empty)
  const suggestions = WAGE_DESCRIPTIONS.filter((item) => {
    const query = (description || '').trim().toLowerCase()
    return query === '' || item.toLowerCase().includes(query)
  })

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (descriptionWrapRef.current && !descriptionWrapRef.current.contains(e.target)) {
        setDescriptionOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const paymentErrorMessage = (txHash) => {
    return (
      'Произошла ошибка, но платеж был создан в сети. Хэш платежа:\n\n' +
      txHash +
      '.\n\n' +
      'Проверьте статус платежа позже и, если он завершен успешно,\n' +
      "добавьте его через кнопку 'Зачесть'\n" +
      'Иначе сделайте еще одну попытку.'
    )
  }

  const createWage = async () => {
    const response = await fetch(`/api/admin/user/${selectedUser.id}/wages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({
        amount: amount,
        description: description.trim(),
      }),
    })
    const result = await response.json()
    if (!response.ok) {
      throw new Error(`Не удалось сохранить данные: ${result.error}.`)
    }
  }

  const handleComplete = async () => {
    if (!window.confirm(CONFIRMATION_TEXT)) return

    setSaving(true)
    setError('')

    try {
      await createWage()
      onSuccess()
    } catch (err) {
      setError(err.message || 'Ошибка создания начисления')
    } finally {
      setSaving(false)
    }
  }

  const onSubmit = async () => {
    setSaving(true)
    setError('')
    setLoaderText('Ожидаем подпись...')
    let txHash = null

    try {
      if (!window.ethereum) throw new Error('Кошелек не найден. Установите MetaMask или Trust Wallet.')
      if (!companyWallet) throw new Error('Не указан кошелек компании для отправки средств')
      if (!selectedUser.wallet) throw new Error('Не указан кошелек получателя для начисления')

      const destination = getAddress(selectedUser.wallet)
      const tokenAddress = getAddress(usdtAddress)

      // Ensure correct chain
      await ensureChain(window.ethereum)

      const walletClient = getWalletClient(window.ethereum)

      const [account] = await walletClient.requestAddresses()
      if (!account) throw new Error('Не удалось получить адрес кошелька')

      // Send USDT transfer from company wallet to the payment's fromWallet
      const transferValue = parseUnits(amount.toFixed(2), usdtDecimals)
      txHash = await walletClient.writeContract({
        account,
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [destination, transferValue],
      })

      setLoaderText('Ожидаем подтверждение сети...')

      const publicClient = getPublicClient()
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
      if (receipt.status !== 'success') throw new Error('Транзакция не была подтверждена сетью')

      await createWage()
      onSuccess()
    } catch (err) {
      if (txHash) setError(paymentErrorMessage(txHash))
      else setError(err.shortMessage ? `Ошибка сети: ${err.shortMessage}` : err.message)
    } finally {
      setSaving(false)
      setLoaderText('')
    }
  }

  return (
    <Modal title="Добавить начисление" isStatic onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className={styles.container}>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="amount">
            Сумма (USDT)
          </label>
          <input
            id="amount"
            type="number"
            className={styles.input}
            step="any"
            disabled={saving}
            {...register('amount', {
              required: 'Обязательное поле',
              valueAsNumber: true,
              min: { value: 0, message: 'Сумма не может быть отрицательной' },
              max: { value: 100000, message: 'Слишком большая сумма' },
            })}
          />
          {errors.amount && <p className={styles.fieldError}>{errors.amount.message}</p>}
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="description">
            Описание
          </label>
          <div className={styles.combobox} ref={descriptionWrapRef}>
            <input
              id="description"
              className={styles.input}
              placeholder="Выберите или введите назначение"
              disabled={saving}
              autoComplete="off"
              onFocus={() => setDescriptionOpen(true)}
              {...register('description', {
                required: 'Обязательное поле',
                validate: (value) => (value && value.trim() !== '') || 'Выберите назначение',
              })}
            />
            {descriptionOpen && suggestions.length > 0 && (
              <ul className={styles.comboboxDropdown}>
                {suggestions.map((item) => (
                  <li
                    key={item}
                    className={classNames(styles.comboboxOption, {
                      [styles.comboboxOptionActive]: description === item,
                    })}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handleSelectDescription(item)
                    }}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {errors.description && <p className={styles.fieldError}>{errors.description.message}</p>}
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <button type="submit" className={styles.actionButton} disabled={!canTransfer || saving}>
            {saving ? loaderText || 'Сохранение...' : 'Перевести'}
          </button>
          <button
            type="button"
            className={styles.actionButton}
            disabled={!canCredit || saving}
            onClick={handleComplete}
          >
            {saving ? 'Сохранение...' : 'Зачесть'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default AddWageModal
