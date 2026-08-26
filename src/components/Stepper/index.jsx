import styles from './index.module.css'

const Stepper = ({ min, max, value, onChange }) => {
  const decrement = () => onChange(value - 1)

  const increment = () => onChange(value + 1)

  return (
    <div className={styles.stepper}>
      <button className={styles.stepperButton} onClick={decrement} disabled={value <= min} aria-label="Уменьшить">
        −
      </button>
      <span className={styles.stepperValue}>{value}</span>
      <button className={styles.stepperButton} onClick={increment} disabled={value >= max} aria-label="Увеличить">
        +
      </button>
    </div>
  )
}

export default Stepper
