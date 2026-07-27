import Link from 'next/link'
import { Card, CardBody } from '@heroui/card'
import { Image } from '@heroui/image'
import { KunCardStats } from '~/components/kun/CardStats'
import { KunPatchAttribute } from '~/components/kun/PatchAttribute'
import { cn } from '~/utils/cn'
import { kunCjkIndentClass } from '~/utils/kunCjkIndent'

interface Props {
  patch: GalgameCard
}

export const SearchCard = ({ patch }: Props) => {
  return (
    <Card
      isPressable
      as={Link}
      href={`/${patch.uniqueId}`}
      className="w-full border border-default-100 dark:border-default-200"
      target="_blank"
    >
      <CardBody className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative w-full sm:w-40">
            <Image
              src={
                patch.banner
                  ? patch.banner.replace(/\.avif$/, '-mini.avif')
                  : '/touchgal.avif'
              }
              alt={patch.name}
              className="object-cover rounded-lg size-full"
              radius="lg"
            />
          </div>
          <div className="flex-1 space-y-3">
            <h2
              className={cn(
                'text-lg font-semibold transition-colors line-clamp-2 hover:text-primary-500',
                kunCjkIndentClass(patch.name)
              )}
            >
              {patch.name}
            </h2>

            <KunCardStats patch={patch} isMobile={true} />

            <KunPatchAttribute types={patch.type} size="sm" />
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
