interface Props {
  hint: string
}

export const LazyDialogFallback = ({ hint }: Props) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="flex min-h-32 w-full max-w-sm flex-col items-center justify-center gap-3 rounded-large border border-divider bg-content1 p-6 text-content1-foreground shadow-large">
        <div className="size-8 animate-spin rounded-full border-3 border-default-200 border-t-primary" />
        <p className="text-sm text-default-500">{hint}</p>
      </div>
    </div>
  )
}
