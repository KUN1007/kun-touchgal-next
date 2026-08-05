'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow
} from '@heroui/react'
import { useState } from 'react'
import { RenderCell } from './RenderCell'
import type { AdminCreator } from '~/types/api/admin'

interface Props {
  initialCreators: AdminCreator[]
  total: number
}

const columns = [
  { name: '申请人', uid: 'sender' },
  { name: '状态', uid: 'status' },
  { name: '时间', uid: 'created' },
  { name: '操作', uid: 'actions' }
]

export const Creator = ({ initialCreators, total }: Props) => {
  const [creators, setCreators] = useState<AdminCreator[]>(initialCreators)

  // 同意/拒绝后就地更新该行状态 (2 - 同意, 3 - 拒绝), 不整表刷新
  const handleCreatorUpdated = (creatorId: number, status: number) => {
    setCreators((prev) =>
      prev.map((creator) =>
        creator.id === creatorId ? { ...creator, status } : creator
      )
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="mb-6 text-2xl font-bold">创作者管理</h1>
      <Table aria-label="创作者管理">
        <TableHeader columns={columns}>
          {(column) => (
            <TableColumn key={column.uid}>{column.name}</TableColumn>
          )}
        </TableHeader>
        <TableBody>
          {creators.map((creator) => (
            <TableRow key={creator.id}>
              {(columnKey) => (
                <TableCell>
                  {RenderCell({
                    creator,
                    columnKey: columnKey.toString(),
                    onUpdate: handleCreatorUpdated
                  })}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
