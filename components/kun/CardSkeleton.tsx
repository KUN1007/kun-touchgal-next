import { Card, CardBody } from '@heroui/card'

interface Props {
  count?: number
}

export const KunCardSkeleton = ({ count = 3 }: Props) => {
  return (
    <div className="space-y-4" role="status" aria-label="加载中">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index}>
          <CardBody className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="size-8 shrink-0 animate-pulse rounded-full bg-default-200 motion-reduce:animate-none" />
              <div className="h-4 w-1/4 animate-pulse rounded-lg bg-default-200 motion-reduce:animate-none" />
            </div>
            <div className="h-4 w-full animate-pulse rounded-lg bg-default-200 motion-reduce:animate-none" />
            <div className="h-4 w-2/3 animate-pulse rounded-lg bg-default-200 motion-reduce:animate-none" />
          </CardBody>
        </Card>
      ))}
    </div>
  )
}
