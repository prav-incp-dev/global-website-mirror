import { useState } from 'react'
import styles from './index.module.css'
import { walletPreview } from '@/lib/wallet'
import DownloadIcon from '@/assets/icons/DownloadIcon.svg?react'
import ExportWagesModal from '../ExportWagesModal'

const ViewProfile = ({ company, onEdit }) => {
  const [exportWallet, setExportWallet] = useState(null)

  const handleExportClose = () => {
    setExportWallet(null)
  }

  const getWalletLabel = (walletField) => {
    if (walletField === 'serviceWallet') return 'сервисный счет'
    if (walletField === 'cumulativeWallet') return 'накопительный счет'
    return ''
  }

  return (
    <div>
      <div className={styles.row}>
        <span className={styles.label}>Название компании</span>
        <span className={styles.value}>{company?.name || '—'}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Распределительный счет компании</span>
        <span className={styles.value} title={company?.wallet || '—'}>
          {walletPreview(company?.wallet)}
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Счет на обслуживание системы (1%)</span>
        <div className={styles.valueRow}>
          <span className={styles.value} title={company?.serviceWallet || '—'}>
            {walletPreview(company?.serviceWallet)}
          </span>
          {company?.serviceWallet && (
            <button
              className={styles.downloadButton}
              onClick={() => setExportWallet('serviceWallet')}
              title="Выгрузить начисления"
            >
              <DownloadIcon />
            </button>
          )}
        </div>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Накопительный счет</span>
        <div className={styles.valueRow}>
          <span className={styles.value} title={company?.cumulativeWallet || '—'}>
            {walletPreview(company?.cumulativeWallet)}
          </span>
          {company?.cumulativeWallet && (
            <button
              className={styles.downloadButton}
              onClick={() => setExportWallet('cumulativeWallet')}
              title="Выгрузить начисления"
            >
              <DownloadIcon />
            </button>
          )}
        </div>
      </div>

      <button className={styles.editButton} onClick={onEdit}>
        Редактировать
      </button>

      {exportWallet && (
        <ExportWagesModal
          onClose={handleExportClose}
          wallet={company[exportWallet]}
          walletLabel={getWalletLabel(exportWallet)}
        />
      )}
    </div>
  )
}

export default ViewProfile
