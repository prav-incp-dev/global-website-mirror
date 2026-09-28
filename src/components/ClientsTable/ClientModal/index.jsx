import { useState } from 'react'
import classNames from 'classnames'
import { useClientsContext } from '../ClientsContext'
import Modal from '../../Modal'
import GeneralInfoTab from '../GeneralInfoTab'
import AchievementsTab from '../AchievementsTab'
import WagesTab from '../WagesTab'
import { UserRole } from '@/generated/prisma/enums'
import styles from './index.module.css'

const TAB_GENERAL = 'general'
const TAB_ACHIEVEMENTS = 'achievements'
const TAB_WAGES = 'wages'

const ClientModal = ({ onClose }) => {
  const { selectedUser } = useClientsContext()
  const [activeTab, setActiveTab] = useState(TAB_GENERAL)

  if (!selectedUser) return null

  const isConsultant = selectedUser.role === UserRole.Consultant

  return (
    <Modal title="Информация о пользователе" onClose={onClose}>
      {isConsultant && (
        <div className={styles.tabs}>
          <button
            className={classNames(styles.tab, { [styles.tabActive]: activeTab === TAB_GENERAL })}
            onClick={() => setActiveTab(TAB_GENERAL)}
          >
            Общая информация
          </button>
          <button
            className={classNames(styles.tab, { [styles.tabActive]: activeTab === TAB_ACHIEVEMENTS })}
            onClick={() => setActiveTab(TAB_ACHIEVEMENTS)}
          >
            Достижения
          </button>
          <button
            className={classNames(styles.tab, { [styles.tabActive]: activeTab === TAB_WAGES })}
            onClick={() => setActiveTab(TAB_WAGES)}
          >
            Начисления
          </button>
        </div>
      )}

      {activeTab === TAB_GENERAL && <GeneralInfoTab />}

      {activeTab === TAB_ACHIEVEMENTS && isConsultant && <AchievementsTab />}

      {isConsultant && (
        <div className={classNames(styles.wagesTab, { [styles.hidden]: activeTab !== TAB_WAGES })}>
          <WagesTab active={activeTab == TAB_WAGES} />
        </div>
      )}
    </Modal>
  )
}

export default ClientModal
