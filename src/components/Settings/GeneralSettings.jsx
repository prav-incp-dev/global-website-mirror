import styles from './settings.module.css'

const GeneralSettings = ({ form, onChange }) => {
  return (
    <div className={styles.fields}>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Срок бездействия для предупреждения (дней)</span>
        <input
          type="number"
          className={styles.input}
          value={form.staleDays}
          onChange={(e) => onChange('staleDays', Number(e.target.value))}
          min={0}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Срок бездействия для открепления (дней)</span>
        <input
          type="number"
          className={styles.input}
          value={form.orphantDays}
          onChange={(e) => onChange('orphantDays', Number(e.target.value))}
          min={0}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Время пользователю на отмену платежа (минут)</span>
        <input
          type="number"
          className={styles.input}
          value={form.refundMinutes}
          onChange={(e) => onChange('refundMinutes', Number(e.target.value))}
          min={0}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Комиссия за отмену платежа (%)</span>
        <input
          type="number"
          className={styles.input}
          value={form.refundFee}
          onChange={(e) => onChange('refundFee', Number(e.target.value))}
          min={0}
          step={0.1}
        />
      </label>
    </div>
  )
}

export default GeneralSettings
