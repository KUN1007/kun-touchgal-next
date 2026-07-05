import { ResetForm } from '~/components/auth/forgot/ResetForm'
import { ErrorComponent } from '~/components/error/ErrorComponent'
import { getKv } from '~/lib/redis'
import { createForgotPasswordResetKey } from '~/app/api/utils/sendResetPasswordLinkEmail'
import { kunMetadata } from './metadata'
import type { Metadata } from 'next'

export const metadata: Metadata = kunMetadata

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Props {
  searchParams?: Promise<{ token?: string }>
}

export default async function Kun({ searchParams }: Props) {
  const res = await searchParams
  const token = res?.token

  if (!token || !uuidRegex.test(token)) {
    return (
      <ErrorComponent error="重置链接无效或已过期, 请重新发起重置密码请求" />
    )
  }

  const stored = await getKv(createForgotPasswordResetKey(token))
  if (!stored) {
    return (
      <ErrorComponent error="重置链接无效或已过期, 请重新发起重置密码请求" />
    )
  }

  return <ResetForm token={token} />
}
