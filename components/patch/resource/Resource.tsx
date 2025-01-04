'use client'

import { useEffect, useState } from 'react'
import {
  Button,
  Card,
  CardBody,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure
} from '@nextui-org/react'
import { Edit, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { kunFetchDelete, kunFetchGet } from '~/utils/kunFetch'
import { PublishResource } from './publish/PublishResource'
import { EditResourceDialog } from './edit/EditResourceDialog'
import { useUserStore } from '~/store/providers/user'
import { ResourceInfo } from './ResourceInfo'
import { ResourceDownload } from './ResourceDownload'
import toast from 'react-hot-toast'
import { KunLoading } from '~/components/kun/Loading'
import type { PatchResource } from '~/types/api/patch'

interface Props {
  id: number
}

export const Resources = ({ id }: Props) => {
  const [resources, setResources] = useState<PatchResource[]>([])
  const [isLoading, setIsLoading] = useState(false)
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      const res = await kunFetchGet<PatchResource[]>('/patch/resource', {
        patchId: Number(id)
      })
      setIsLoading(false)
      setResources(res)
    }
    fetchData()
  }, [])

  const {
    isOpen: isOpenCreate,
    onOpen: onOpenCreate,
    onClose: onCloseCreate
  } = useDisclosure()

  const {
    isOpen: isOpenEdit,
    onOpen: onOpenEdit,
    onClose: onCloseEdit
  } = useDisclosure()
  const { user } = useUserStore((state) => state)
  const [editResource, setEditResource] = useState<PatchResource | null>(null)

  const {
    isOpen: isOpenDelete,
    onOpen: onOpenDelete,
    onClose: onCloseDelete
  } = useDisclosure()
  const [deleteResourceId, setDeleteResourceId] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const handleDeleteResource = async () => {
    setDeleting(true)

    await kunFetchDelete<KunResponse<{}>>('/patch/resource', {
      resourceId: deleteResourceId
    })

    setResources((prev) =>
      prev.filter((resource) => resource.id !== deleteResourceId)
    )
    setDeleteResourceId(0)
    setDeleting(false)
    onCloseDelete()
    toast.success('删除资源链接成功')
  }

  if (isLoading) {
    return <KunLoading hint="正在加载 Galgame 资源..." className="min-h-48" />
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          color="primary"
          variant="solid"
          startContent={<Plus className="size-4" />}
          onPress={onOpenCreate}
        >
          添加资源
        </Button>
      </div>

      {resources.map((resource) => (
        <Card key={resource.id}>
          <CardBody className="space-y-2">
            <div className="flex items-start justify-between">
              <ResourceInfo resource={resource} />

              <Dropdown>
                <DropdownTrigger>
                  <Button variant="light" isIconOnly>
                    <MoreHorizontal
                      aria-label="补丁资源操作"
                      className="size-4"
                    />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu
                  aria-label="Resource actions"
                  disabledKeys={
                    user.uid === resource.userId ? [] : ['edit', 'delete']
                  }
                >
                  <DropdownItem
                    key="edit"
                    startContent={<Edit className="size-4" />}
                    onPress={() => {
                      setEditResource(resource)
                      onOpenEdit()
                    }}
                  >
                    编辑
                  </DropdownItem>
                  <DropdownItem
                    key="delete"
                    className="text-danger"
                    color="danger"
                    startContent={<Trash2 className="size-4" />}
                    onPress={() => {
                      onOpenDelete()
                      setDeleteResourceId(resource.id)
                    }}
                  >
                    删除
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </div>

            <ResourceDownload resource={resource} />
          </CardBody>
        </Card>
      ))}

      <Modal
        size="3xl"
        isOpen={isOpenCreate}
        onClose={onCloseCreate}
        scrollBehavior="outside"
        isDismissable={false}
        isKeyboardDismissDisabled={true}
      >
        <PublishResource
          patchId={id}
          onClose={onCloseCreate}
          onSuccess={(res) => {
            setResources([...resources, res])
            onCloseCreate()
          }}
        />
      </Modal>

      <Modal
        size="3xl"
        isOpen={isOpenEdit}
        onClose={onCloseEdit}
        scrollBehavior="outside"
        isDismissable={false}
        isKeyboardDismissDisabled={true}
      >
        <EditResourceDialog
          onClose={onCloseEdit}
          resource={editResource!}
          onSuccess={(res) => {
            setResources((prevResources) =>
              prevResources.map((resource) =>
                resource.id === res.id ? res : resource
              )
            )
            onCloseEdit()
          }}
        />
      </Modal>

      <Modal isOpen={isOpenDelete} onClose={onCloseDelete} placement="center">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            删除资源链接
          </ModalHeader>
          <ModalBody>
            <p>
              您确定要删除这条资源链接吗,
              这将会导致您发布资源链接获得的萌萌点被扣除, 该操作不可撤销
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onCloseDelete}>
              取消
            </Button>
            <Button
              color="danger"
              onPress={handleDeleteResource}
              disabled={deleting}
              isLoading={deleting}
            >
              删除
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
