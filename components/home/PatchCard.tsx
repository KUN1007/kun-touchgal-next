import Link from 'next/link'
import { Card, CardBody } from '@heroui/card'
import { Image } from '@heroui/image'
import { KunCardStats } from '~/components/kun/CardStats'
import { cn } from '~/utils/cn'
import { kunCjkIndentClass } from '~/utils/kunCjkIndent'

interface Props {
  patch: GalgameCard
}

export const PatchCard = ({ patch }: Props) => {
  return (
    <Card
      isPressable
      as={Link}
      href={`/${patch.uniqueId}`}
      className="w-full border border-default-100 dark:border-default-200"
    >
      <CardBody>
        <div className="relative w-full pb-[56.25%]">
          <Image
            removeWrapper
            src={patch.banner.replace(/\.avif$/, '-mini.avif')}
            alt={patch.name}
            className="absolute inset-0 object-cover rounded-lg size-full"
            radius="lg"
          />
        </div>
        <div className="mt-3 space-y-3">
          <h2
            className={cn(
              'text-lg font-semibold transition-colors line-clamp-2 hover:text-primary-500',
              kunCjkIndentClass(patch.name)
            )}
          >
            {patch.name}
          </h2>
          <KunCardStats patch={patch} isMobile={true} />
        </div>
      </CardBody>
    </Card>
  )
}
