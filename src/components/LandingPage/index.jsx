import { useNavigate } from 'react-router'
import styles from './index.module.css'

const LandingPage = () => {
  const navigate = useNavigate()

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <p className={styles.text}>Приветствуем Вас</p>
        <p className={styles.text}>на сайте INCP</p>
        <h1 className={styles.title}>International Club of Participants</h1>
        <h2 className={styles.subtitle}>Международный клуб участников</h2>
        <button className={styles.button} onClick={() => navigate('/auth')}>ВОЙТИ</button>
      </div>
    </div>
  )
}

export default LandingPage
