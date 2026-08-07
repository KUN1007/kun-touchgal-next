'use client'

import { useEffect } from 'react'

interface Props {
  confirmPath: string
}

// confirm 是带副作用的 route handler，其 303 链最终跨域跳回对侧站点：
// 若经 RSC 软导航进入（如登录后 router.push 回跳），后台 fetch 会跟随 303
// 消费掉一次性 interaction，再因跨域 CORS 失败回退重放请求，触发 SessionNotFound。
// 故必须用整页跳转（document navigation）进入 confirm，不能用 redirect()。
export const ConfirmRedirect = ({ confirmPath }: Props) => {
  useEffect(() => {
    window.location.replace(confirmPath)
  }, [confirmPath])

  return (
    <div className="mx-auto mt-20 max-w-md px-4 text-center">
      <p className="text-default-500">正在完成授权，请稍候……</p>
    </div>
  )
}
