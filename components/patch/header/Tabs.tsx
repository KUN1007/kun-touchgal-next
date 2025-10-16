import { Tab, Tabs } from '@heroui/tabs'
import { IntroductionTab } from '~/components/patch/introduction/IntroductionTab'
import { ResourceTab } from '~/components/patch/resource/ResourceTab'
import { CommentTab } from '~/components/patch/comment/CommentTab'
import { RatingTab } from '~/components/patch/rating/RatingTab'
import type { PatchIntroduction } from '~/types/api/patch'
import type { Dispatch, SetStateAction } from 'react'

interface PatchHeaderProps {
  id: number
  vndbId: string
  uid?: number
  intro: PatchIntroduction
  selected: string
  setSelected: Dispatch<SetStateAction<string>>
}

export const PatchHeaderTabs = ({
  id,
  vndbId,
  uid,
  intro,
  selected,
  setSelected
}: PatchHeaderProps) => {
  return (
    <Tabs
      className="w-full my-6 overflow-hidden shadow-medium rounded-large"
      fullWidth={true}
      defaultSelectedKey="introduction"
      onSelectionChange={(value) => {
        setSelected(value.toString())
      }}
      selectedKey={selected}
    >
      <Tab key="introduction" title="游戏信息" className="p-0 min-w-20">
        <IntroductionTab intro={intro} patchId={Number(id)} uid={uid} />
      </Tab>

      <Tab key="resources" title="资源链接" className="p-0 min-w-20">
        <ResourceTab id={id} vndbId={vndbId} />
      </Tab>

      <Tab key="comments" title="讨论版" className="p-0 min-w-20">
        <CommentTab id={id} />
      </Tab>

      <Tab key="rating" title="游戏评价" className="p-0 min-w-20">
        <RatingTab id={id} />
      </Tab>
    </Tabs>
  )
}
