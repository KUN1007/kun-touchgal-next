'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'

interface LazySettingsSectionProps {
  title: string
  description: string
  minHeight: string
  Component: ComponentType
}

const LazySectionPlaceholder = ({
  title,
  description,
  minHeight
}: Omit<LazySettingsSectionProps, 'Component'>) => {
  return (
    <div
      className="flex w-full flex-col justify-center rounded-2xl border border-default-200 bg-content1 px-6 py-5 text-sm text-default-500"
      style={{ minHeight }}
    >
      <h2 className="mb-2 text-xl font-medium text-foreground">{title}</h2>
      <p>{description}</p>
    </div>
  )
}

const AccountSecuritySettings = dynamic(
  () =>
    import('./AccountSecuritySettings').then(
      (mod) => mod.AccountSecuritySettings
    ),
  {
    ssr: false,
    loading: () => (
      <LazySectionPlaceholder
        title="账号安全"
        description="正在加载邮箱、密码、两步验证和清除数据设置。"
        minHeight="920px"
      />
    )
  }
)

const NotificationPrivacySettings = dynamic(
  () =>
    import('./NotificationPrivacySettings').then(
      (mod) => mod.NotificationPrivacySettings
    ),
  {
    ssr: false,
    loading: () => (
      <LazySectionPlaceholder
        title="通知与隐私"
        description="正在加载邮件通知、私信和屏蔽标签设置。"
        minHeight="640px"
      />
    )
  }
)

const LazySettingsSection = ({
  title,
  description,
  minHeight,
  Component
}: LazySettingsSectionProps) => {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [shouldRender, setShouldRender] = useState(false)

  useEffect(() => {
    if (shouldRender) return

    const element = sectionRef.current
    if (!element) return

    if (!('IntersectionObserver' in window)) {
      setShouldRender(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldRender(true)
          observer.disconnect()
        }
      },
      { rootMargin: '400px 0px' }
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [shouldRender])

  return (
    <div ref={sectionRef} className="space-y-8">
      {shouldRender ? (
        <Component />
      ) : (
        <LazySectionPlaceholder
          title={title}
          description={description}
          minHeight={minHeight}
        />
      )}
    </div>
  )
}

export const LazyUserSettingsSections = () => {
  return (
    <>
      <LazySettingsSection
        title="账号安全"
        description="滚动到此分区后再加载邮箱、密码、两步验证和清除数据设置。"
        minHeight="920px"
        Component={AccountSecuritySettings}
      />
      <LazySettingsSection
        title="通知与隐私"
        description="滚动到此分区后再加载邮件通知、私信和屏蔽标签设置。"
        minHeight="640px"
        Component={NotificationPrivacySettings}
      />
    </>
  )
}
