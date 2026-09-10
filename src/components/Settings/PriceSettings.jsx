import classNames from 'classnames'
import styles from './settings.module.css'

const PriceSettings = ({ form, onChange }) => {
  return (
    <div className={styles.fields}>
      <div className={styles.levelTable}>
        <div className={styles.levelHeader}>
          <span className={styles.priceColUnits}>Единицы</span>
          <span className={styles.priceColCost}>Стоимость</span>
        </div>
        {Object.entries(form).map(([units, cost]) => (
          <div key={units} className={styles.levelRow}>
            <span className={styles.priceColUnits}>{units}</span>
            <input
              type="number"
              className={classNames(styles.input, styles.priceInput)}
              value={cost}
              onChange={(e) => onChange(Number(units), Number(e.target.value))}
              min={0}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default PriceSettings
