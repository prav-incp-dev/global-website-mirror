import classNames from 'classnames'
import ChevronIcon from '@/assets/icons/ChevronIcon.svg?react'
import styles from './index.module.css'

const WageRow = ({ wage, isExpanded, onToggle }) => {
  return (
    <div className={styles.item}>
      <div
        className={styles.itemRow}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onClick={() => onToggle(wage.id)}
      >
        <span className={styles.amount}>{`$${wage.amount.toFixed(2)}`} USDT</span>
        <span className={classNames(styles.chevron, { [styles.chevronOpen]: isExpanded })}>
          <ChevronIcon className={styles.chevronIcon} />
        </span>
      </div>

      {isExpanded && (
        <div className={styles.details}>
          <span className={styles.date}>{new Date(wage.createdAt).toLocaleString('ru-RU')}</span>
          <span className={styles.description}>{wage.description || '—'}</span>
          { wage.score > 0 && <span className={styles.score}>{`Начислено личных единиц: ${wage.score}`}</span>}
          { wage.groupScore > 0 && <span className={styles.score}>{`Начислено групповых единиц: ${wage.groupScore}`}</span>}
        </div>
      )}
    </div>
  )
}

export default WageRow
