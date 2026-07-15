import styles from './404.module.css'

const NotFound = () => {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.code}>404</h1>
        <p className={styles.message}>Page does not exist</p>
        <a href="/" className={styles.link}>
          Go back home
        </a>
      </div>
    </div>
  )
}

export default NotFound
