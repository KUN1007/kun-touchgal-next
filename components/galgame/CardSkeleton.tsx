export const GalgameCardSkeleton = () => {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-[22px] border border-default-200/60 bg-background shadow-[0_12px_32px_rgba(15,23,42,0.05)] dark:bg-content1 dark:shadow-[0_12px_32px_rgba(0,0,0,0.15)]">
      <div
        className="w-full animate-pulse bg-default-200 motion-reduce:animate-none"
        style={{ aspectRatio: '16/9' }}
      />
      <div className="flex flex-1 flex-col gap-2 p-3 sm:gap-3 sm:p-4">
        <div className="h-4 w-4/5 animate-pulse rounded-lg bg-default-200 motion-reduce:animate-none sm:h-5" />
        <div className="mt-auto space-y-2 sm:space-y-3">
          <div className="h-4 w-24 animate-pulse rounded-lg bg-default-200 motion-reduce:animate-none" />
          <div className="flex gap-1.5 pt-0.5">
            <div className="h-5 w-8 animate-pulse rounded-lg bg-default-200 motion-reduce:animate-none sm:h-6 sm:w-11" />
            <div className="h-5 w-8 animate-pulse rounded-lg bg-default-200 motion-reduce:animate-none sm:h-6 sm:w-11" />
          </div>
        </div>
      </div>
    </div>
  )
}
