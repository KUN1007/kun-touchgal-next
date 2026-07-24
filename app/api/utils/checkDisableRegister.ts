import { getKv } from '~/lib/redis'
import { KUN_PATCH_DISABLE_REGISTER_KEY } from '~/config/redis'

export const checkDisableRegister = async () => {
  const isDisableRegister = await getKv(KUN_PATCH_DISABLE_REGISTER_KEY)
  if (isDisableRegister) {
    return '由于网站近日遭受大量攻击，当前时间段暂时不可注册，请明天下午再来，一定要来哦'
  }
  return null
}
