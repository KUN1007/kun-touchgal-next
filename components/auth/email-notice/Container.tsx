'use client'

import { kunMoyuMoe } from '~/config/moyu-moe'
import { Suspense } from 'react'
import { KunEmailNoticeCard } from './KunEmailNoticeCard'

export const KunContainer = () => {
  return (
    <div className="container mx-auto mt-4 mb-8">
      <div className="flex flex-col items-center justify-center gap-8">
        <div className="text-center">
          <h1 className="mb-2 text-3xl font-medium">邮件通知退订</h1>
          <p className="text-default-500">
            如果您要退订, 请点击下面的按钮, 您将不再收到任何关于{' '}
            {kunMoyuMoe.titleShort} 的邮件通知
          </p>
        </div>

        <Suspense>
          <KunEmailNoticeCard />
        </Suspense>
      </div>
    </div>
  )
}
