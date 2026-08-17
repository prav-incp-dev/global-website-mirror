import { useState } from 'react'
import styles from './index.module.css'

const TreeNode = ({ node }) => {
  const [isOpen, setIsOpen] = useState(false)
  const hasChildren = node.children && node.children.length > 0

  return (
    <div className={styles.container}>
      <div onClick={() => hasChildren && setIsOpen(!isOpen)} className={hasChildren ? styles.row : styles.rowLeaf}>
        {hasChildren ? (
          <span className={`${styles.arrow} ${isOpen ? styles.arrowOpen : ''}`}>▶</span>
        ) : (
          <span className={styles.bullet}>•</span>
        )}

        <span>{node.firstName}</span>
      </div>

      {isOpen && hasChildren && (
        <div className={styles.childrenContainer}>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} />
          ))}
        </div>
      )}
    </div>
  )
}

export default TreeNode
