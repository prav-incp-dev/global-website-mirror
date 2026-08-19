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

// 2. Пост-обход для отметки isStale и hasStaleDescendant на каждом узле
const markStaleNodes = (nodes, staleDays) => {
  const deadline = Date.now() - staleDays * 24 * 60 * 60 * 1000

  for (const node of nodes) {
    if (node.children?.length) markStaleNodes(node.children, staleDays)

    const lastInteractionTime = node.lastInteractionDate ? new Date(node.lastInteractionDate).getTime() : 0
    node.isStale = lastInteractionTime < deadline
    node.hasStaleDescendant = node.children?.some((c) => c.isStale || c.hasStaleDescendant) ?? false
  }
}

// 3. Главный компонент, принимающий плоский список с Fastify API
export default function Structure({ csrfToken }) {
  const { descendants, staleDays } = useDescendantsContext()
  const treeData = useMemo(() => {
    const tree = buildTree(descendants)
    markStaleNodes(tree, staleDays)
    return tree
  }, [descendants, staleDays])

  return (
    <div className={styles.container}>
      {treeData.map((rootNode) => (
        <TreeNode key={rootNode.id} node={rootNode} csrfToken={csrfToken} />
      ))}
    </div>
  )
}
