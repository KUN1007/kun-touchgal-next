'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { KunHeader } from '~/components/kun/Header'
import {
  SettingsNav,
  userSettingsNavItems,
  type UserSettingsSectionId
} from '~/components/settings/Nav'
import { UserAvatar } from './Avatar'
import { Username } from './Username'
import { Bio } from './Bio'
import { LazyUserSettingsSections } from './LazyUserSettingsSections'
import { SettingsGroup } from './SettingsGroup'

const profileSettings = userSettingsNavItems[0]
const securitySettings = userSettingsNavItems[1]
const privacySettings = userSettingsNavItems[2]
const contentControlSettings = userSettingsNavItems[3]
const appealSettings = userSettingsNavItems[4]

const isUserSettingsSectionId = (
  value: string | null
): value is UserSettingsSectionId =>
  userSettingsNavItems.some((item) => item.id === value)

export const UserSettings = () => {
  const searchParams = useSearchParams()
  const [activeSectionId, setActiveSectionId] = useState<UserSettingsSectionId>(
    () => {
      const tab = searchParams.get('tab')
      return isUserSettingsSectionId(tab) ? tab : profileSettings.id
    }
  )
  const [mountedSectionIds, setMountedSectionIds] = useState<
    ReadonlySet<UserSettingsSectionId>
  >(() => new Set([profileSettings.id, activeSectionId]))

  const handleSelectSection = (sectionId: UserSettingsSectionId) => {
    setActiveSectionId(sectionId)
    setMountedSectionIds((currentSectionIds) => {
      if (currentSectionIds.has(sectionId)) {
        return currentSectionIds
      }

      const nextSectionIds = new Set(currentSectionIds)
      nextSectionIds.add(sectionId)
      return nextSectionIds
    })
  }

  // 系统通知等入口通过 ?tab= 深链定位分页, 页内再次点击同类链接时也需切换
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (isUserSettingsSectionId(tab)) {
      handleSelectSection(tab)
    }
  }, [searchParams])

  const isProfileSettings = activeSectionId === profileSettings.id
  const isSecuritySettings = activeSectionId === securitySettings.id
  const isPrivacySettings = activeSectionId === privacySettings.id
  const isContentControlSettings = activeSectionId === contentControlSettings.id
  const isAppealSettings = activeSectionId === appealSettings.id
  const hasMountedSecuritySettings = mountedSectionIds.has(securitySettings.id)
  const hasMountedPrivacySettings = mountedSectionIds.has(privacySettings.id)
  const hasMountedContentControlSettings = mountedSectionIds.has(
    contentControlSettings.id
  )
  const hasMountedAppealSettings = mountedSectionIds.has(appealSettings.id)

  return (
    <div className="my-4 w-full px-3 sm:px-0">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <KunHeader
          name="账户设置"
          description="按分类管理个人资料、账号安全、通知隐私与内容偏好。"
        />

        <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
          <SettingsNav
            activeId={activeSectionId}
            onSelect={handleSelectSection}
          />

          <div className="min-w-0 space-y-5">
            <SettingsGroup id={profileSettings.id} isActive={isProfileSettings}>
              <UserAvatar />
              <Username />
              <Bio />
            </SettingsGroup>

            {hasMountedSecuritySettings && (
              <LazyUserSettingsSections
                activeSectionId={securitySettings.id}
                isActive={isSecuritySettings}
              />
            )}

            {hasMountedPrivacySettings && (
              <LazyUserSettingsSections
                activeSectionId={privacySettings.id}
                isActive={isPrivacySettings}
              />
            )}

            {hasMountedContentControlSettings && (
              <LazyUserSettingsSections
                activeSectionId={contentControlSettings.id}
                isActive={isContentControlSettings}
              />
            )}

            {hasMountedAppealSettings && (
              <LazyUserSettingsSections
                activeSectionId={appealSettings.id}
                isActive={isAppealSettings}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
