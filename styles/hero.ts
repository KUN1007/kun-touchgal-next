import { heroui } from '@heroui/react'

// 暗色模式页面背景默认是纯黑 (#000000), OLED 上易致卡片边界发糊、对比生硬。
// 改成与主题 zinc 色阶同源的冷调深灰: 保持低于 content1 (zinc-900 #18181b),
// 让卡片/浮层仍能在页面之上形成层级, 只覆盖 background 一处, 其余沿用默认。
export default heroui({
  themes: {
    dark: {
      colors: {
        background: '#0f0f12'
      }
    }
  }
})
