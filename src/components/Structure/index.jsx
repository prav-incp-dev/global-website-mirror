import React, { useMemo } from 'react'
import TreeNode from './TreeNode'

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
      roots.push(node) // Верхний уровень (parentId === null или отсутствует)
    }
  })

  return roots
}

// 2. Главный компонент, принимающий плоский список с Fastify API
export default function Structure({ descendants }) {
  const treeData = useMemo(() => buildTree(descendants), [descendants])
  console.log('=======', descendants, treeData)

  return (
    <div>
      {treeData.map((rootNode) => (
        <TreeNode key={rootNode.id} node={rootNode} />
      ))}
    </div>
  )
}
