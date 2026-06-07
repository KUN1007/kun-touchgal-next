import { Chip } from '@heroui/chip'
import { Sparkles } from 'lucide-react'

export const KunAboutHeader = () => {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-500/10 via-secondary-500/10 to-success-500/10 px-5 py-6 shadow-sm sm:px-8 sm:py-8">
      <div className="pointer-events-none absolute -right-20 -top-20 size-48 rounded-full bg-primary-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-12 size-56 rounded-full bg-success-500/10 blur-3xl" />

      <div className="relative max-w-3xl space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Chip
            color="primary"
            variant="flat"
            startContent={<Sparkles className="size-4" />}
          >
            TouchGal Docs
          </Chip>
          <span className="text-sm text-default-500">帮助、规则与社区指南</span>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-bold leading-tight text-transparent bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text sm:text-5xl">
            帮助文档
          </h1>
          <p className="max-w-2xl text-base leading-7 text-default-600 sm:text-lg">
            汇总 TouchGal 的使用说明、发布规范与常见问题。先从目录快速定位，
            也可以直接浏览下方精选文档。
          </p>
        </div>
      </div>
    </section>
  )
}
