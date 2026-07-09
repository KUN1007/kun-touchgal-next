interface Props {
  rows?: number
}

export const KunTableSkeleton = ({ rows = 6 }: Props) => {
  return (
    <div className="space-y-2" role="status" aria-label="加载中">
      <div className="h-12 animate-pulse rounded-lg bg-default-100 motion-reduce:animate-none" />
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-14 animate-pulse rounded-lg bg-default-200 motion-reduce:animate-none"
        />
      ))}
    </div>
  )
}
