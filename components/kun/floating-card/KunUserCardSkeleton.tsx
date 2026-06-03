const SkeletonStat = ({ label }: { label: string }) => {
  return (
    <div className="rounded-medium border border-divider bg-content2/40 p-2 text-center">
      <div className="mx-auto mb-1 h-4 w-8 animate-pulse rounded-small bg-default-200" />
      <div className="text-xs text-default-500">{label}</div>
    </div>
  )
}

export const KunUserCardSkeleton = () => {
  return (
    <div className="w-[300px] p-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="size-12 shrink-0 animate-pulse rounded-full bg-default-200" />
          <div className="min-w-0 space-y-2">
            <div className="h-4 w-24 animate-pulse rounded-small bg-default-200" />
            <div className="h-3 w-36 animate-pulse rounded-small bg-default-100" />
          </div>
        </div>
        <div className="h-8 w-16 shrink-0 animate-pulse rounded-medium bg-default-100" />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <SkeletonStat label="关注者" />
        <SkeletonStat label="Galgame 数" />
        <SkeletonStat label="资源数" />
      </div>
    </div>
  )
}
