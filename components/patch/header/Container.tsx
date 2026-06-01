import { PatchHeaderTabs } from './Tabs'
import { PatchHeaderInfo } from './Info'
import { PatchHeaderClientEffects } from './ClientEffects'
import { KunAutoImageViewer } from '~/components/kun/image-viewer/AutoImageViewer'
import { KunNull } from '~/components/kun/Null'
import type { Patch, PatchIntroduction } from '~/types/api/patch'

interface PatchHeaderProps {
  patch: Patch
  intro: PatchIntroduction
  uid?: number
  nsfwAllowed: boolean
}

export const PatchHeaderContainer = ({
  patch,
  intro,
  uid,
  nsfwAllowed
}: PatchHeaderProps) => {
  const isNsfwBlocked = patch.contentLimit === 'nsfw' && !nsfwAllowed

  return (
    <div className="relative w-full mx-auto max-w-7xl">
      {isNsfwBlocked ? (
        <KunNull
          message={
            !uid ? '请登录后查看' : '请在右上角菜单开启 NSFW 内容显示后查看'
          }
        />
      ) : (
        <>
          <PatchHeaderClientEffects
            patch={patch}
            released={intro.released}
            isNsfwBlocked={isNsfwBlocked}
          />
          <KunAutoImageViewer />

          <PatchHeaderInfo patch={patch} />

          <PatchHeaderTabs
            id={patch.id}
            vndbId={patch.vndbId || ''}
            intro={intro}
            uid={uid}
          />
        </>
      )}
    </div>
  )
}
