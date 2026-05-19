export const resourceTypes = [
  {
    value: 'pc',
    label: 'PC游戏',
    description: '在 Windows, macOS 等电脑设备上运行的游戏'
  },
  {
    value: 'row',
    label: '生肉资源',
    description: '没有中文翻译, 仅有日语或其它语言的 Galgame'
  },
  {
    value: 'chinese',
    label: '汉化资源',
    description: '汉化 Galgame 下载资源, 有简体中文或繁体中文支持'
  },
  {
    value: 'patch',
    label: '补丁资源',
    description: '与这个 Galgame 相关的补丁资源'
  },
  {
    value: 'mobile',
    label: '手机游戏',
    description: '可以在手机上运行的 Galgame 游戏'
  },
  {
    value: 'emulator',
    label: '模拟器资源',
    description:
      '可以在手机模拟器, 例如 KiriKiri, ONS, Tyranor 等模拟器中运行的 Galgame 游戏'
  },
  {
    value: 'app',
    label: '直装资源',
    description: '可以直接在手机安装并游玩的 Galgame'
  },
  {
    value: 'tool',
    label: '游戏工具',
    description: '辅助游玩 Galgame 的工具, 例如 KRKR 模拟器, Magpie 等'
  },
  {
    value: 'notice',
    label: '官方通知',
    description: '由官方发布的站点通知'
  },
  {
    value: 'other',
    label: '其它',
    description: '其它内容'
  }
]

export const SUPPORTED_TYPE = [
  'pc',
  'chinese',
  'mobile',
  'emulator',
  'row',
  'app',
  'patch',
  'tool',
  'notice',
  'other'
]
export const SUPPORTED_TYPE_MAP: Record<string, string> = {
  all: '全部类型',
  pc: 'PC游戏',
  chinese: '汉化资源',
  mobile: '手机游戏',
  emulator: '模拟器资源',
  row: '生肉资源',
  app: '直装资源',
  patch: '补丁资源',
  tool: '游戏工具',
  notice: '官方通知',
  other: '其它'
}
export const ALL_SUPPORTED_TYPE = ['all', ...SUPPORTED_TYPE]

export const SUPPORTED_LANGUAGE = ['zh-Hans', 'zh-Hant', 'ja', 'en', 'other']
export const ALL_SUPPORTED_LANGUAGE = ['all', ...SUPPORTED_LANGUAGE]
export const SUPPORTED_LANGUAGE_MAP: Record<string, string> = {
  all: '全部语言',
  'zh-Hans': '简体中文',
  'zh-Hant': '繁體中文',
  ja: '日本語',
  en: 'English',
  other: '其它'
}

export const SUPPORTED_PLATFORM = [
  'windows',
  'android',
  'macos',
  'ios',
  'linux',
  'other'
]
export const ALL_SUPPORTED_PLATFORM = ['all', ...SUPPORTED_PLATFORM]
export const SUPPORTED_PLATFORM_MAP: Record<string, string> = {
  all: '全部平台',
  windows: 'Windows',
  android: 'Android',
  macos: 'MacOS',
  ios: 'iOS',
  linux: 'Linux',
  other: '其它'
}

export const SUPPORTED_RESOURCE_LINK = ['touchgal', 's3', 'user']

export const OBJECT_STORAGE_MAX_FILE_SIZE_BYTES = 1024 * 1024 * 1024
export const OBJECT_STORAGE_MAX_FILE_SIZE_LABEL = '1GB'
export const OBJECT_STORAGE_MAX_FILE_SIZE_ERROR = `文件大小超过限制, 必须小于 ${OBJECT_STORAGE_MAX_FILE_SIZE_LABEL}`
export const RESOURCE_DAILY_UPLOAD_LIMIT_MB = 5120

export const storageTypes = [
  {
    value: 'touchgal',
    label: 'TouchGal 资源盘 (官方可用)',
    description: '此选项用于官方发布 Galgame 下载资源'
  },
  {
    value: 's3',
    label: `对象存储 (<${OBJECT_STORAGE_MAX_FILE_SIZE_LABEL}, 创作者可用)`,
    description: `此选项适合 <${OBJECT_STORAGE_MAX_FILE_SIZE_LABEL} 的资源, 稳定, 永远不会失效过期`
  },
  {
    value: 'user',
    label: `自定义链接 (>=${OBJECT_STORAGE_MAX_FILE_SIZE_LABEL})`,
    description: `此选项适合 >=${OBJECT_STORAGE_MAX_FILE_SIZE_LABEL} 的资源, 这需要您自行提供下载链接`
  }
]

export const SUPPORTED_RESOURCE_LINK_MAP: Record<string, string> = {
  touchgal: 'TouchGal 资源盘',
  s3: '对象存储下载',
  user: '自定义链接下载'
}

export const ALLOWED_MIME_TYPES = [
  'application/zip',
  'application/x-lz4',
  'application/x-rar-compressed'
]

export const ALLOWED_EXTENSIONS = ['.zip', '.rar', '.7z']

export const SUPPORTED_RESOURCE_SECTION = ['galgame', 'patch']

export const RESOURCE_SECTION_MAP: Record<string, string> = {
  galgame: 'Galgame 资源',
  patch: 'Galgame 补丁'
}
