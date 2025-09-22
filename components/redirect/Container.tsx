'use client'

import { Suspense } from 'react'
import { Alert, Image, Link } from '@heroui/react'
import { KunRedirectCard } from './KunRedirectCard'
import { kunMoyuMoe } from '~/config/moyu-moe'

export const KunRedirectContainer = () => {
  return (
    <div className="container mx-auto my-8">
      <div className="flex flex-col items-center justify-center gap-8">
        <div className="text-center">
          <h1 className="mb-2 text-3xl font-medium">外部链接跳转</h1>
          <p className="text-default-500">在您继续前往之前, 请确认下方的链接</p>
        </div>

        <Suspense>
          <KunRedirectCard />
        </Suspense>

        <div className="max-w-2xl">
          <Alert
            description="下载如果出现问题请至公告中的常见问题文章寻找解决方法, 如果下载缓慢可以试试下方广告中的加速器"
            title="公告"
            color="secondary"
            variant="faded"
          />
        </div>

        <div className="w-full max-w-2xl rounded-large">
          <Link isExternal href="https://www.sailingnet.pro/">
            <Image
              alt={kunMoyuMoe.title}
              src="https://s.touchgaloss.cfd/2024/09/6e194add9120240905110255.webp"
            />
          </Link>
        </div>
      </div>
    </div>
  )
}
