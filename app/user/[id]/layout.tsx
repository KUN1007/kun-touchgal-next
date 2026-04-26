import { ErrorComponent } from '~/components/error/ErrorComponent'
import { UserProfile } from '~/components/user/Profile'
import { UserStats } from '~/components/user/Stats'
import { UserActivity } from '~/components/user/Activity'
import { generateKunMetadataTemplate } from './metadata'
import { kunGetActions } from './actions'
import { verifyHeaderCookie } from '~/utils/actions/verifyHeaderCookie'
import { KunNull } from '~/components/kun/Null'
import { KunBreadcrumbTitle } from '~/components/kun/BreadcrumbTitle'
import type { Metadata } from 'next'

interface Props {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

export const generateMetadata = async ({
  params
}: Props): Promise<Metadata> => {
  const { id } = await params
  const user = await kunGetActions(Number(id))
  if (typeof user === 'string') {
    return {}
  }
  return generateKunMetadataTemplate(user)
}

export default async function Kun({ params, children }: Props) {
  const { id } = await params
  if (isNaN(Number(id))) {
    return <ErrorComponent error={'提取页面参数错误'} />
  }

  const user = await kunGetActions(Number(id))
  if (!user || typeof user === 'string') {
    return <ErrorComponent error={user} />
  }

  const payload = await verifyHeaderCookie()

  return (
    <div className="w-full py-8 mx-auto">
      <KunBreadcrumbTitle
        routeKey={`/user/${user.id}`}
        title={`${user.name} 的主页`}
      />
      {payload?.uid ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <UserProfile user={user} />

          <div className="space-y-6 lg:col-span-2">
            <UserStats user={user} />
            <UserActivity id={user.id} />
            {children}
          </div>
        </div>
      ) : (
        <KunNull message="请登录后查看用户个人信息" />
      )}
    </div>
  )
}
