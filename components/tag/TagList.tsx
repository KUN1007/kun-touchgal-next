import { KunMasonry } from '~/components/kun/KunMasonry'
import { TagCard } from './Card'
import { KunNull } from '~/components/kun/Null'
import { KunLoading } from '~/components/kun/Loading'
import type { Tag as TagType } from '~/types/api/tag'
import { useSettingStore } from '~/store/settingStore'

interface TagListProps {
  tags: TagType[]
  loading: boolean
  searching: boolean
}

export const TagList = ({ tags, loading, searching }: TagListProps) => {
  const settings = useSettingStore((state) => state.data)
  const isNSFWEnabled =
    settings.kunNsfwEnable === 'nsfw' || settings.kunNsfwEnable === 'all'

  if (loading) {
    return <KunLoading hint="正在获取标签数据..." />
  }

  if (!searching && tags.length === 0) {
    return (
      <KunNull
        message={
          isNSFWEnabled
            ? '您已启用显示 NSFW 内容, 但未找到相关内容, 请尝试使用游戏的日文原名搜索'
            : '未找到相关内容, 请尝试使用游戏的日文原名搜索或打开 NSFW'
        }
      />
    )
  }

  return (
    <KunMasonry columnWidth={256} gap={16} estimatedItemHeight={112}>
      {tags.map((tag) => (
        <TagCard key={tag.id} tag={tag} />
      ))}
    </KunMasonry>
  )
}
