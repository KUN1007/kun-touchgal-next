'use client'

import { Button, Card, CardBody, CardHeader, Chip } from '@heroui/react'

const SCOPE_LABEL: Record<string, string> = {
  openid: '确认你的身份（唯一标识）',
  profile: '你的用户名、头像与简介',
  email: '你的邮箱地址',
  offline_access: '在你离线时保持登录'
}

interface Props {
  clientName: string
  scopes: string[]
  interactionPath: string
}

export const ConsentCard = ({ clientName, scopes, interactionPath }: Props) => {
  return (
    <div className="mx-auto mt-20 max-w-md px-4">
      <Card>
        <CardHeader className="flex-col items-start gap-1">
          <h1 className="text-xl font-semibold">授权请求</h1>
          <p className="text-sm text-default-500">
            <span className="font-medium text-foreground">{clientName}</span>{' '}
            请求访问你的 TouchGal 账号
          </p>
        </CardHeader>
        <CardBody className="gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-default-500">该应用将获得：</p>
            <div className="flex flex-wrap gap-2">
              {scopes.map((item) => (
                <Chip key={item} variant="flat" color="primary">
                  {SCOPE_LABEL[item] ?? item}
                </Chip>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <form
              method="post"
              action={`${interactionPath}/confirm`}
              className="flex-1"
            >
              <Button type="submit" color="primary" fullWidth>
                同意授权
              </Button>
            </form>
            <form
              method="post"
              action={`${interactionPath}/confirm?error=access_denied`}
              className="flex-1"
            >
              <Button type="submit" variant="bordered" fullWidth>
                取消
              </Button>
            </form>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
