'use client'

import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Switch
} from '@heroui/react'
import { Eye, EyeOff, Settings } from 'lucide-react'
import { useSettingStore } from '~/store/settingStore'
import { ThemeSwitcher } from './ThemeSwitcher'

export const SettingsDropdown = () => {
  const settings = useSettingStore((state) => state.data)
  const setData = useSettingStore((state) => state.setData)

  return (
    <Dropdown>
      <DropdownTrigger>
        <Button variant="light" isIconOnly radius="full" className="w-10 h-10" aria-label="设置">
          <Settings className="size-6 text-default-500" />
        </Button>
      </DropdownTrigger>
      <DropdownMenu aria-label="Settings" className="min-w-[240px]">
        <DropdownItem
          key="nsfw"
          className="h-12"
          startContent={
            settings.kunNsfwEnable ? (
              <Eye className="w-4 h-4" />
            ) : (
              <EyeOff className="w-4 h-4" />
            )
          }
        >
          显示 NSFW 内容
        </DropdownItem>
        <DropdownItem key="theme" textValue="主题切换" className="h-12">
          <ThemeSwitcher />
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  )
}
