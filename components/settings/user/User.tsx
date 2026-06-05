'use client'

import { useState } from 'react'
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

export const UserSettings = () => {
  const [activeSectionId, setActiveSectionId] = useState<UserSettingsSectionId>(
    profileSettings.id
  )
  const [mountedSectionIds, setMountedSectionIds] = useState<
    ReadonlySet<UserSettingsSectionId>
  >(() => new Set([profileSettings.id]))

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

  const isProfileSettings = activeSectionId === profileSettings.id
  const isSecuritySettings = activeSectionId === securitySettings.id
  const isPrivacySettings = activeSectionId === privacySettings.id
  const isContentControlSettings = activeSectionId === contentControlSettings.id
  const hasMountedSecuritySettings = mountedSectionIds.has(securitySettings.id)
  const hasMountedPrivacySettings = mountedSectionIds.has(privacySettings.id)
  const hasMountedContentControlSettings = mountedSectionIds.has(
    contentControlSettings.id
  )

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
          </div>
        </div>
      </div>
    </div>
  )
}
