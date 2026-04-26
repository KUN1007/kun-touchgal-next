'use client'

import { useState } from 'react'
import { kunMoyuMoe } from '~/config/moyu-moe'
import { Button, Card, CardBody, CardFooter, Snippet } from '@heroui/react'
import { ExternalLink, ShieldAlert } from 'lucide-react'
import { CountdownTimer } from './CountdownTimer'
import { useSearchParams } from 'next/navigation'
import { useUserStore } from '~/store/userStore'
import { useMounted } from '~/hooks/useMounted'
import { isRedirectableUrl, sanitizeUserHref } from '~/utils/safeUrl'

export const KunRedirectCard = () => {
  const isMounted = useMounted()
  const searchParams = useSearchParams()
  const userConfig = useUserStore((state) => state.user)

  const [isCountdownComplete, setIsCountdownComplete] = useState(false)

  const rawUrl = searchParams.get('url')
  const sanitizedUrl = rawUrl ? sanitizeUserHref(rawUrl) : null
  const isUrlValid = !!sanitizedUrl && isRedirectableUrl(sanitizedUrl)
  const url = isUrlValid ? sanitizedUrl! : kunMoyuMoe.domain.main
  const isInvalid = !!rawUrl && !isUrlValid

  const handleRedirect = () => {
    const safe = sanitizeUserHref(url)
    if (!safe || !isRedirectableUrl(safe)) {
      return
    }
    window.location.href = safe
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardBody className="gap-4">
        <div
          className={`flex items-center gap-2 ${
            isInvalid ? 'text-danger-500' : 'text-warning-500'
          }`}
        >
          <ShieldAlert className="w-5 h-5" />
          <p className="text-lg">
            {isInvalid
              ? '检测到不安全或无效的跳转链接, 已阻止跳转'
              : `您即将离开 ${kunMoyuMoe.titleShort}`}
          </p>
        </div>

        <p className="text-default-500">
          {isInvalid ? '原始链接 (已阻止):' : '您将会被跳转到:'}
        </p>

        <div className="overflow-auto">
          <Snippet
            disableCopy
            symbol=""
            size="lg"
            className="w-full overflow-auto scrollbar-hide"
            color={isInvalid ? 'danger' : 'primary'}
            copyIcon={<ExternalLink />}
          >
            {isInvalid ? rawUrl! : url}
          </Snippet>
        </div>

        {isMounted && !isInvalid && (
          <CountdownTimer
            delay={userConfig.delaySeconds}
            onComplete={() => setIsCountdownComplete(true)}
          />
        )}
      </CardBody>

      <CardFooter className="justify-center">
        <Button
          size="lg"
          color="primary"
          variant="shadow"
          onPress={handleRedirect}
          isDisabled={!isCountdownComplete || isInvalid}
        >
          点击跳转
        </Button>
      </CardFooter>
    </Card>
  )
}
