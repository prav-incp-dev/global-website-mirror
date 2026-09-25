import styles from './index.module.css'

const LandingPage = () => {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <p className={styles.text}>Приветствуем Вас</p>
        <p className={styles.text}>на сайте INCP</p>
        <h1 className={styles.title}>International Club of Participants</h1>
        <h2 className={styles.subtitle}>Международный клуб участников</h2>
        <button className={styles.button} onClick={() => window.location.assign('/auth')}>
          ВОЙТИ
        </button>
      </div>
    </div>
  )
}

export default LandingPage
