import { RESOURCE_SECTION_MAP } from '~/constants/resource'
import type { PatchResource } from '~/types/api/patch'

// 资源展示名兜底规则: 无名称时回退资源分区名;
// 决定资源页 H1 / <title> / 面包屑末级, 改动须三处同步 (资源卡片无名称时不显示标题)
export const getResourcePageTitle = (
  resource: Pick<PatchResource, 'name' | 'section'>
) => resource.name || (RESOURCE_SECTION_MAP[resource.section] ?? '下载资源')
