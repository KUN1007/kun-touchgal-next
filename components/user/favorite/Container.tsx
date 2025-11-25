'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure
} from '@heroui/react'
import { Folder } from 'lucide-react'
import { kunFetchDelete, kunFetchGet } from '~/utils/kunFetch'
import { kunErrorHandler } from '~/utils/kunErrorHandler'
import { EditFolderModal } from './EditFolderModal'
import { UserGalgameCard } from './Card'
import { KunLoading } from '~/components/kun/Loading'
import { KunNull } from '~/components/kun/Null'
import toast from 'react-hot-toast'
import { KunPagination } from '~/components/kun/Pagination'
import type { UserFavoritePatchFolder } from '~/types/api/user'

interface Props {
  initialFolders: UserFavoritePatchFolder[]
  pageUid: number
  currentUserUid: number
}

export const UserFavorite = ({
  initialFolders,
  pageUid,
  currentUserUid
}: Props) => {
  const [folders, setFolders] =
    useState<UserFavoritePatchFolder[]>(initialFolders)
  const [selectedFolder, setSelectedFolder] =
    useState<UserFavoritePatchFolder | null>(null)
  const [patches, setPatches] = useState<GalgameCard[]>([])
  const [isPending, startTransition] = useTransition()
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const {
    isOpen: isOpenFolder,
    onOpen: onOpenFolder,
    onClose: onCloseFolder
  } = useDisclosure()
  const fetchPatchesInFolder = async (folderId: number) => {
    startTransition(async () => {
      const res = await kunFetchGet<
        KunResponse<{ patches: GalgameCard[]; total: number }>
      >(`/user/profile/favorite/folder/patch`, { folderId, page, limit: 48 })
      kunErrorHandler(res, (value) => {
        setPatches(value.patches)
        setTotal(value.total)
      })
    })
  }

  useEffect(() => {
    if (selectedFolder) {
      fetchPatchesInFolder(selectedFolder.id)
    }
  }, [page])

  const {
    isOpen: isOpenDelete,
    onOpen: onOpenDelete,
    onClose: onCloseDelete
  } = useDisclosure()
  const handleDeleteFolder = async () => {
    startTransition(async () => {
      const res = await kunFetchDelete<KunResponse<{}>>(
        `/user/profile/favorite/folder`,
        { folderId: selectedFolder?.id ?? 0 }
      )
      kunErrorHandler(res, () => {
        setFolders((prev) => prev.filter((p) => p.id !== selectedFolder?.id))
        onCloseDelete()
        onCloseFolder()
        toast.success('删除收藏夹成功')
      })
    })
  }

  const handlePressFolderCard = (folder: UserFavoritePatchFolder) => {
    setSelectedFolder(folder)
    fetchPatchesInFolder(folder.id)
    onOpenFolder()
  }

  const onRemoveFavorite = (patchId: number) => {
    setPatches((prev) => prev.filter((p) => p.id !== patchId))
  }

  const onEditFolderSuccess = (updatedFolder: UserFavoritePatchFolder) => {
    setSelectedFolder(updatedFolder)
    setFolders((prev) =>
      prev.map((folder) =>
        folder.id === updatedFolder.id ? updatedFolder : folder
      )
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">收藏夹</h2>
        {currentUserUid === pageUid && (
          <EditFolderModal
            action="create"
            onActionSuccess={(value) => setFolders([...folders, value])}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {folders.map((folder) => (
          <Card
            key={folder.id}
            isPressable
            onPress={() => handlePressFolderCard(folder)}
            className={selectedFolder?.id === folder.id ? 'border-primary' : ''}
          >
            <CardHeader className="flex justify-between">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4" />
                <span className="font-semibold">{folder.name}</span>
              </div>
            </CardHeader>
            <CardBody className="justify-between gap-2">
              <p className="text-small text-default-500 line-clamp-2">
                {folder.description}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-small">
                  {folder._count.patch} 个 Galgame
                </span>
                {folder.is_public ? (
                  <span className="text-small text-primary">公开</span>
                ) : (
                  <span className="text-small text-danger">私密</span>
                )}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Modal
        size="5xl"
        scrollBehavior="inside"
        isOpen={isOpenFolder}
        onClose={onCloseFolder}
      >
        {selectedFolder && (
          <ModalContent>
            <ModalHeader className="flex-col">
              <div className="flex items-center justify-between">
                <p>{selectedFolder.name}</p>
              </div>

              <p className="font-normal text-small text-default-500">
                {selectedFolder.description}
              </p>
            </ModalHeader>

            <ModalBody>
              <div className="space-y-3">
                {isPending ? (
                  <KunLoading hint="正在获取收藏数据..." />
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {patches.map((galgame) => (
                      <UserGalgameCard
                        key={galgame.id}
                        galgame={galgame}
                        folderId={selectedFolder.id}
                        onRemoveFavorite={onRemoveFavorite}
                        pageUid={pageUid}
                        currentUserUid={currentUserUid}
                      />
                    ))}
                  </div>
                )}

                {!isPending && !patches.length && (
                  <KunNull message="收藏夹为空" />
                )}

                {!isPending && (
                  <div className="flex justify-center">
                    <KunPagination
                      total={Math.ceil(total / 48)}
                      page={page}
                      onPageChange={setPage}
                      isLoading={isPending}
                    />
                  </div>
                )}
              </div>
            </ModalBody>

            {currentUserUid === pageUid && (
              <ModalFooter>
                <Button color="danger" variant="light" onPress={onOpenDelete}>
                  删除
                </Button>
                <EditFolderModal
                  action="update"
                  folderId={selectedFolder.id}
                  folder={selectedFolder}
                  onActionSuccess={onEditFolderSuccess}
                />
              </ModalFooter>
            )}
          </ModalContent>
        )}
      </Modal>

      <Modal isOpen={isOpenDelete} onClose={onCloseDelete} placement="center">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">删除收藏夹</ModalHeader>
          <ModalBody>
            您确定要删除这个收藏夹吗, 这将会彻底删除收藏夹,
            并移除所有收藏夹中收藏的游戏, 该操作不可撤销
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onCloseDelete}>
              取消
            </Button>
            <Button
              color="danger"
              onPress={handleDeleteFolder}
              disabled={isPending}
              isLoading={isPending}
            >
              删除
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
