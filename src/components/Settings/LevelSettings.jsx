import classNames from 'classnames'
import styles from './settings.module.css'

const LevelSettings = ({ form, onChange }) => {
  return (
    <div className={styles.fields}>
      <div className={styles.levelTable}>
        <div className={styles.levelHeader}>
          <span className={styles.levelColLevel}>Ур.</span>
          <span className={styles.levelColPercent}>%</span>
          <span className={styles.levelColPlan}>Личн. (ед. в мес.)</span>
          <span className={styles.levelColPlan}>Общ. (ед. в мес.)</span>
          <span className={styles.levelColConfirm}>Подтв. (ед. в мес.)</span>
        </div>
        {Object.entries(form).map(([level, data]) => (
          <div key={level} className={styles.levelRow}>
            <span className={styles.levelColLevel}>{level}</span>
            <input
              type="number"
              className={classNames(styles.input, styles.levelInput)}
              value={data.percent}
              onChange={(e) => onChange({ level: Number(level), name: 'percent', value: Number(e.target.value) })}
              step={0.1}
              min={0}
              max={100}
            />
            <input
              type="number"
              className={classNames(styles.input, styles.levelInput)}
              value={data.personal}
              onChange={(e) => onChange({ level: Number(level), name: 'personal', value: Number(e.target.value) })}
              min={0}
            />
            <input
              type="number"
              className={classNames(styles.input, styles.levelInput)}
              value={data.general}
              onChange={(e) => onChange({ level: Number(level), name: 'general', value: Number(e.target.value) })}
              min={0}
            />
            <input
              type="number"
              className={classNames(styles.input, styles.levelInput)}
              value={data.confirm}
              onChange={(e) => onChange({ level: Number(level), name: 'confirm', value: Number(e.target.value) })}
              min={0}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default LevelSettings
