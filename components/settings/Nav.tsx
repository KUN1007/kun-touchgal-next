export const userSettingsNavItems = [
  {
    id: 'profile',
    title: '个人资料',
    description: '头像、用户名与主页签名'
  },
  {
    id: 'security',
    title: '账号安全',
    description: '邮箱、密码、登录会话、两步验证与数据清理'
  },
  {
    id: 'notification-privacy',
    title: '通知与隐私',
    description: '邮件提醒与私信开关'
  },
  {
    id: 'content-control',
    title: '内容控制',
    description: '标签屏蔽与内容可见性'
  }
] as const

export type UserSettingsSectionId = (typeof userSettingsNavItems)[number]['id']

interface SettingsNavProps {
  activeId: UserSettingsSectionId
  onSelect: (id: UserSettingsSectionId) => void
}

const getPanelId = (id: UserSettingsSectionId) => `${id}-settings-panel`
const getTabId = (id: UserSettingsSectionId) => `${id}-settings-tab`

interface SettingsTabKeyEvent {
  key: string
  preventDefault: () => void
  currentTarget: HTMLButtonElement
}

export const SettingsNav = ({ activeId, onSelect }: SettingsNavProps) => {
  const handleKeyDown = (event: SettingsTabKeyEvent, index: number) => {
    const lastIndex = userSettingsNavItems.length - 1
    let nextIndex = index

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = index === lastIndex ? 0 : index + 1
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = index === 0 ? lastIndex : index - 1
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = lastIndex
    } else {
      return
    }

    event.preventDefault()
    const nextId = userSettingsNavItems[nextIndex].id
    onSelect(nextId)
    document.getElementById(getTabId(nextId))?.focus()
  }

  return (
    <aside className="min-w-0 lg:sticky lg:top-24">
      <nav
        aria-label="账户设置分类"
        className="min-w-0 rounded-3xl border border-default-200 bg-content1/80 p-3 shadow-medium backdrop-blur"
      >
        <ul
          role="tablist"
          className="flex min-w-0 gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0"
        >
          {userSettingsNavItems.map((item, index) => {
            const isActive = activeId === item.id

            return (
              <li
                key={item.id}
                role="presentation"
                className="w-56 shrink-0 lg:w-auto"
              >
                <button
                  id={getTabId(item.id)}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={getPanelId(item.id)}
                  onClick={() => onSelect(item.id)}
                  onKeyDown={(event) => handleKeyDown(event, index)}
                  tabIndex={isActive ? 0 : -1}
                  className={`group flex h-full w-full flex-col rounded-2xl px-3 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-medium'
                      : 'text-foreground hover:bg-default-100'
                  }`}
                >
                  <span className="text-sm font-medium">{item.title}</span>
                  <span
                    className={`mt-1 text-xs leading-5 ${
                      isActive
                        ? 'text-primary-foreground/80'
                        : 'text-default-500'
                    }`}
                  >
                    {item.description}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
