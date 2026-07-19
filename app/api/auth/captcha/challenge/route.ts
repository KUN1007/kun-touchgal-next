import { NextResponse } from 'next/server'
import { generateChallenge } from 'capjs-core'
import { KUN_CAP_CHALLENGE_SCOPE } from '~/constants/captcha'

// Cap widget 的挑战签发端点。挑战是 HMAC 签名的 JWT, 签发零存储,
// 响应格式遵循 Cap 协议, 由 <cap-widget> 消费
export const POST = async () => {
  const challenge = await generateChallenge(process.env.KUN_CAP_SECRET!, {
    scope: KUN_CAP_CHALLENGE_SCOPE
  })
  return NextResponse.json(challenge)
}
