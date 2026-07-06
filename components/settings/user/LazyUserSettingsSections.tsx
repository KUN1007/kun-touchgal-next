'use client'

import dynamic from 'next/dynamic'
import {
  userSettingsNavItems,
  type UserSettingsSectionId
} from '~/components/settings/Nav'
import { SettingsGroup } from './SettingsGroup'

type LazyUserSettingsSectionId = Exclude<UserSettingsSectionId, 'profile'>

interface LazyUserSettingsSectionsProps {
  activeSectionId: LazyUserSettingsSectionId
  isActive: boolean
}

interface LazySectionPlaceholderProps {
  title: string
  description: string
  minHeight: string
}

const securitySettings = userSettingsNavItems[1]
const privacySettings = userSettingsNavItems[2]
const contentControlSettings = userSettingsNavItems[3]
const appealSettings = userSettingsNavItems[4]

const LazySectionPlaceholder = ({
  title,
  description,
  minHeight
}: LazySectionPlaceholderProps) => {
  return (
    <div
      className="flex w-full flex-col justify-center rounded-[22px] border border-default-200/60 bg-background px-5 py-5 text-sm text-default-500 shadow-[0_12px_32px_rgba(15,23,42,0.05)] dark:bg-content1 dark:shadow-[0_12px_32px_rgba(0,0,0,0.15)]"
      style={{ minHeight }}
    >
      <h2 className="mb-2 text-xl font-semibold text-foreground">{title}</h2>
      <p className="leading-6">{description}</p>
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
        description="正在加载邮件通知和私信设置。"
        minHeight="360px"
      />
    )
  }
)

const ContentControlSettings = dynamic<{ isActive: boolean }>(
  () => import('./BlockedTags').then((mod) => mod.BlockedTags),
  {
    ssr: false,
    loading: () => (
      <LazySectionPlaceholder
        title="内容控制"
        description="正在加载标签屏蔽设置。"
        minHeight="520px"
      />
    )
  }
)

const AppealSettings = dynamic(
  () => import('./appeal/AppealSettings').then((mod) => mod.AppealSettings),
  {
    ssr: false,
    loading: () => (
      <LazySectionPlaceholder
        title="内容申诉"
        description="正在加载被拒内容与申诉记录。"
        minHeight="360px"
      />
    )
  }
)

const getSettingsSectionId = (
  activeSectionId: LazyUserSettingsSectionId
): LazyUserSettingsSectionId => {
  if (activeSectionId === securitySettings.id) {
    return securitySettings.id
  }

  if (activeSectionId === privacySettings.id) {
    return privacySettings.id
  }

  if (activeSectionId === appealSettings.id) {
    return appealSettings.id
  }

  return contentControlSettings.id
}

export const LazyUserSettingsSections = ({
  activeSectionId,
  isActive
}: LazyUserSettingsSectionsProps) => {
  const sectionId = getSettingsSectionId(activeSectionId)

  return (
    <SettingsGroup id={sectionId} isActive={isActive}>
      {sectionId === securitySettings.id ? (
        <AccountSecuritySettings />
      ) : sectionId === privacySettings.id ? (
        <NotificationPrivacySettings />
      ) : sectionId === appealSettings.id ? (
        <AppealSettings />
      ) : (
        <ContentControlSettings isActive={isActive} />
      )}
    </SettingsGroup>
  )
}
