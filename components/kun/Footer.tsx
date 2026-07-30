import { kunMoyuMoe } from '~/config/moyu-moe'
import Link from 'next/link'
import Image from 'next/image'

export const KunFooter = () => {
  return (
    <footer className="w-full mt-8 text-sm border-t border-divider">
      <div className="px-2 mx-auto sm:px-6 max-w-7xl">
        <div className="grid grid-cols-1 items-center justify-items-center gap-4 py-6 md:grid-cols-[1fr_auto_1fr]">
          <Link
            href="/"
            className="flex items-center space-x-2 md:justify-self-start"
          >
            <Image
              src="/logo.webp"
              alt={kunMoyuMoe.titleShort}
              width={30}
              height={30}
            />
            <span>© 2026 {kunMoyuMoe.titleShort}</span>
          </Link>

          <div className="flex flex-wrap justify-center gap-x-8 gap-y-2">
            <Link href="/doc" className="flex items-center">
              使用指南
            </Link>
            <Link
              href={kunMoyuMoe.domain.nav}
              target="_blank"
              className="flex items-center"
            >
              导航页面
            </Link>

            <Link href="/friend-link" className="flex items-center">
              友情链接
            </Link>

            <Link
              href="https://developer.touchgal.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center"
            >
              API
            </Link>

            <Link
              href="https://github.com/KunMoe/kun-touchgal-next"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center"
            >
              GitHub 仓库
            </Link>
          </div>

          <div className="flex space-x-8 md:justify-self-end">
            <span className="flex items-center">联系我们</span>
            <Link
              href={kunMoyuMoe.domain.discord_group}
              className="flex items-center"
              target="_blank"
              rel="noopener noreferrer"
            >
              Discord
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
