import { useEffect, useRef, useState } from 'react'
import { kunFetchGet } from '~/utils/kunFetch'

// 账户设置页读取自身头像 / 签名审核状态, 使「审核中」提示在刷新后持久展示
export const useModerationPending = (
  field: 'avatarPending' | 'bioPending'
) => {
  const [pending, setPending] = useState(false)
  // 用户本次提交后忽略仍在途的初始 GET, 避免旧状态覆盖 POST 刚设的 pending
  const submittedRef = useRef(false)

  useEffect(() => {
    let ignore = false
    const fetchModerationStatus = async () => {
      try {
        const res = await kunFetchGet<{
          avatarPending: boolean
          bioPending: boolean
        }>('/user/setting/moderation-status')
        if (!ignore && !submittedRef.current && res && typeof res !== 'string') {
          setPending(res[field])
        }
      } catch {
        // 审核状态拉取失败不影响页面主功能, 忽略
      }
    }
    fetchModerationStatus()
    return () => {
      ignore = true
    }
  }, [field])

  // 提交后本地即时反映审核状态, 并标记忽略在途初始 GET
  const markPending = (value: boolean) => {
    submittedRef.current = true
    setPending(value)
  }

  return { pending, markPending }
}
