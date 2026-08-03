import styles from './index.module.css'

const getDisplayName = (user) => {
  if (user.nick) return user.nick

  return `${user.firstName} ${user.lastName || ''}`
}

const StatsDashboard = ({ profile, stats }) => {
  const children = stats.children
  const parent = stats.parent

  return (
    <div>
      <div className={styles.section}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Уровень</th>
              <th>Личные продажи</th>
              <th>Групповые продажи</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{profile.level}</td>
              <td>{profile.score}</td>
              <td>{profile.groupScore}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {parent && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Пригласитель</h3>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.nameCol}>Имя</th>
                <th className={styles.levelCol}>Уровень</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={styles.nameCol}>{getDisplayName(parent)}</td>
                <td className={styles.levelCol}>{parent.level}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {!!children.length && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Приглашённые</h3>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.nameCol}>Имя</th>
                <th className={styles.levelCol}>Уровень</th>
              </tr>
            </thead>
            <tbody>
              {children.map((child) => (
                <tr key={child.id}>
                  <td className={styles.nameCol}>{getDisplayName(child)}</td>
                  <td className={styles.levelCol}>{child.level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default StatsDashboard
