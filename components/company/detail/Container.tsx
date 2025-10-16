'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from '@bprogress/next'
import { Button, Chip } from '@heroui/react'
import { useDisclosure } from '@heroui/modal'
import { Link } from '@heroui/link'
import { Pagination } from '@heroui/pagination'
import { Pencil } from 'lucide-react'
import { useMounted } from '~/hooks/useMounted'
import { KunHeader } from '~/components/kun/Header'
import { KunUser } from '~/components/kun/floating-card/KunUser'
import { KunLoading } from '~/components/kun/Loading'
import { GalgameCard } from '~/components/galgame/Card'
import { KunNull } from '~/components/kun/Null'
import { CompanyFormModal } from '../form/CompanyFormModal'
import { formatDistanceToNow } from '~/utils/formatDistanceToNow'
import { kunFetchGet } from '~/utils/kunFetch'
import { SUPPORTED_LANGUAGE_MAP } from '~/constants/resource'
import { useUserStore } from '~/store/userStore'
import type { CompanyDetail } from '~/types/api/company'
import type { FC } from 'react'

interface Props {
  initialCompany: CompanyDetail
  initialPatches: GalgameCard[]
  total: number
}

export const CompanyDetailContainer: FC<Props> = ({
  initialCompany,
  initialPatches,
  total
}) => {
  const { isOpen, onOpen, onClose } = useDisclosure()

  const isMounted = useMounted()
  const user = useUserStore((state) => state.user)
  const router = useRouter()
  const [page, setPage] = useState(1)

  const [company, setCompany] = useState(initialCompany)
  const [patches, setPatches] = useState<GalgameCard[]>(initialPatches)
  const [loading, startTransition] = useTransition()

  const fetchPatches = () => {
    startTransition(async () => {
      const { galgames } = await kunFetchGet<{
        galgames: GalgameCard[]
        total: number
      }>('/company/galgame', {
        companyId: company.id,
        page,
        limit: 24
      })
      setPatches(galgames)
    })
  }

  useEffect(() => {
    if (!isMounted) {
      return
    }
    fetchPatches()
  }, [page])

  return (
    <div className="w-full my-4">
      <KunHeader
        name={company.name}
        description={company.introduction}
        headerEndContent={
          <Chip size="lg" color="primary">
            {company.count} 个 Galgame
          </Chip>
        }
        endContent={
          <div className="flex justify-between">
            <KunUser
              user={company.user}
              userProps={{
                name: company.user.name,
                description: `创建于 ${formatDistanceToNow(company.created)}`,
                avatarProps: {
                  src: company.user?.avatar
                }
              }}
            />

            {user.role > 2 && (
              <Button
                variant="flat"
                color="primary"
                onPress={onOpen}
                startContent={<Pencil />}
              >
                编辑会社信息
              </Button>
            )}
            <CompanyFormModal
              type="edit"
              company={company}
              isOpen={isOpen}
              onClose={onClose}
              onSuccess={(newCompany) => {
                setCompany(newCompany as CompanyDetail)
                onClose()
                router.refresh()
              }}
            />
          </div>
        }
      />

      {company.alias.length > 0 && (
        <div className="mb-4">
          <h2 className="mb-4 text-lg font-semibold">别名</h2>
          <div className="flex flex-wrap gap-2">
            {company.alias.map((alias, index) => (
              <Chip key={index} variant="flat" color="secondary">
                {alias}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {company.official_website.length > 0 && (
        <div className="mb-4">
          <h2 className="mb-4 text-lg font-semibold">官网地址</h2>
          <div className="flex flex-wrap gap-2">
            {company.official_website.map((site, index) => (
              <Link showAnchorIcon isExternal href={site} key={index}>
                {site}
              </Link>
            ))}
          </div>
        </div>
      )}

      {company.primary_language.length > 0 && (
        <div className="mb-4">
          <h2 className="mb-4 text-lg font-semibold">主语言</h2>
          <div className="flex flex-wrap gap-2">
            {company.primary_language.map((language, index) => (
              <Chip key={index} variant="flat" color="success">
                {SUPPORTED_LANGUAGE_MAP[language]}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {company.parent_brand.length > 0 && (
        <div className="mb-4">
          <h2 className="mb-4 text-lg font-semibold">父会社</h2>
          <div className="flex flex-wrap gap-2">
            {company.parent_brand.map((brand, index) => (
              <Chip key={index} variant="flat" color="primary">
                {brand}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <KunLoading hint="正在获取 Galgame 中..." />
      ) : (
        <div>
          <div className="grid grid-cols-2 gap-2 mx-auto mb-8 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {patches.map((patch) => (
              <GalgameCard key={patch.id} patch={patch} />
            ))}
          </div>

          {total > 24 && (
            <div className="flex justify-center">
              <Pagination
                total={Math.ceil(total / 24)}
                page={page}
                onChange={setPage}
                showControls
                size="lg"
                radius="lg"
                classNames={{
                  wrapper: 'gap-2',
                  item: 'w-10 h-10'
                }}
              />
            </div>
          )}

          {!total && <KunNull message="暂无 Galgame, 或您未开启网站 NSFW" />}
        </div>
      )}
    </div>
  )
}
