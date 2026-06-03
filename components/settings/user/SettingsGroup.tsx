import type { ReactNode } from 'react'

interface SettingsGroupProps {
  id: string
  isActive: boolean
  children: ReactNode
}

const getPanelId = (id: string) => `${id}-settings-panel`
const getTabId = (id: string) => `${id}-settings-tab`

export const SettingsGroup = ({
  id,
  isActive,
  children
}: SettingsGroupProps) => {
  return (
    <section
      id={getPanelId(id)}
      role="tabpanel"
      aria-labelledby={getTabId(id)}
      hidden={!isActive}
      className="space-y-6"
    >
      {children}
    </section>
  )
}
