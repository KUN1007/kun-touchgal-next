import { normalizeStringArray } from '~/utils/normalizeStringArray'

// 外部数据源拉取到的标题并入表单别名:
// 保留既有顺序、追加新项、trim 去重、剔除与游戏名相同项
export const mergePatchAlias = (
  existing: readonly string[],
  incoming: readonly string[],
  name: string
): string[] =>
  normalizeStringArray([...existing, ...incoming]).filter((a) => a !== name)
