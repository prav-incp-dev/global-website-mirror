import React, { useMemo } from 'react'
import TreeNode from './TreeNode'
import { useDescendantsContext } from './DescendantsContext'
import styles from './index.module.css'
import { HOURS24 } from '@/lib/constants'

// 1. Helper to build a tree from a flat array in O(N)
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
      roots.push(node) // Root level (parentId === null || missing)
    }
  })

  return roots
}

// 2. Post-order traversal to mark isStale and hasStaleDescendant on each node
const markStaleNodes = (nodes, staleDays) => {
  const deadline = Date.now() - staleDays * HOURS24

  for (const node of nodes) {
    if (node.children?.length) markStaleNodes(node.children, staleDays)

    const lastInteractionTime = node.lastInteractionDate ? new Date(node.lastInteractionDate).getTime() : 0
    node.isStale = lastInteractionTime < deadline
    node.hasStaleDescendant = node.children?.some((c) => c.isStale || c.hasStaleDescendant) ?? false
  }
}

// 3. Main component receiving flat list from Fastify API
export default function Structure({ csrfToken }) {
  const { descendants, staleDays, currentUserId } = useDescendantsContext()
  const treeData = useMemo(() => {
    const tree = buildTree(descendants)
    markStaleNodes(tree, staleDays)
    return tree
  }, [descendants, staleDays])

  return (
    <div className={styles.container}>
      {treeData.map((rootNode) => (
        <TreeNode key={rootNode.id} node={rootNode} csrfToken={csrfToken} currentUserId={currentUserId} />
      ))}
    </div>
  )
}
