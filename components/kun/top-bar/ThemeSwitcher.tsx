'use client'

import { useMemo } from 'react'
import { useTheme } from 'next-themes'
import { useMounted } from '~/hooks/useMounted'
import { Tooltip } from '@heroui/tooltip'
import { Button } from '@heroui/button'
import { Moon, Sun, SunMoon } from 'lucide-react'

enum Theme {
  dark = 'dark',
  light = 'light',
  system = 'system'
}

enum ThemeLabel {
  dark = '深色主题',
  light = '浅色主题',
  system = '跟随系统'
}

const themeOrder: Theme[] = [Theme.light, Theme.dark, Theme.system]

export const ThemeSwitcher = () => {
  const { theme, setTheme } = useTheme()
  const isMounted = useMounted()
  const currentTheme =
    theme === Theme.light || theme === Theme.dark || theme === Theme.system
      ? theme
      : Theme.system
  const displayTheme = isMounted ? currentTheme : Theme.system

  const themeIcon = useMemo(() => {
    if (displayTheme === Theme.light) {
      return <Sun />
    }
    if (displayTheme === Theme.dark) {
      return <Moon />
    }
    return <SunMoon />
  }, [displayTheme])

  const nextTheme =
    themeOrder[(themeOrder.indexOf(displayTheme) + 1) % themeOrder.length]
  const tooltipContent = ThemeLabel[displayTheme]
  return (
    <Tooltip disableAnimation showArrow closeDelay={0} content={tooltipContent}>
      <div className="flex">
        <Button
          isIconOnly
          variant="light"
          aria-label={tooltipContent}
          className="text-default-500"
          isDisabled={!isMounted}
          onPress={() => setTheme(nextTheme)}
        >
          {themeIcon}
        </Button>
      </div>
    </Tooltip>
  )
}
