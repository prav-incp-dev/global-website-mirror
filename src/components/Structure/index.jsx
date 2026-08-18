import React, { useMemo } from 'react'
import TreeNode from './TreeNode'
import { useDescendantsContext } from './DescendantsContext'
import styles from './index.module.css'

// 1. Хелпер для сборки плоского массива в дерево за O(N)
const buildTree = (users) => {
  const map = {}
  const roots = []

  users.forEach((user) => {
    map[user.id] = { ...user, children: [] }
  })

  users.forEach((user) => {
    const node = map[user.id]
    if (user.parentId && map[user.parentId]) {
      map[user.parentId].children.push(node)
    } else {
      roots.push(node) // Верхний уровень (parentId === null || отсутствует)
    }
  })

  return roots
}

// 2. Главный компонент, принимающий плоский список с Fastify API
export default function Structure({ csrfToken }) {
  const { descendants } = useDescendantsContext()
  const treeData = useMemo(() => buildTree(descendants), [descendants])

  return (
    <div className={styles.container}>
      {treeData.map((rootNode) => (
        <TreeNode key={rootNode.id} node={rootNode} csrfToken={csrfToken} />
      ))}
    </div>
  )
}
