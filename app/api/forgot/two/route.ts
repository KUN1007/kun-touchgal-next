import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { kunParsePostBody } from '~/app/api/utils/parseQuery'
import { stepTwoSchema } from '~/validations/forgot'
import { prisma } from '~/prisma/index'
import { hashPassword } from '~/app/api/utils/algorithm'
import { verifyVerificationCode } from '~/app/api/utils/verifyVerificationCode'

const stepTwo = async (input: z.infer<typeof stepTwoSchema>) => {
  if (input.newPassword !== input.confirmPassword) {
    return '两次密码输入不一致'
  }

  const normalizedInput = input.name.toLowerCase()
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: normalizedInput, mode: 'insensitive' } },
        { name: { equals: normalizedInput, mode: 'insensitive' } }
      ]
    }
  })
  if (!user) {
    return '您的邮箱验证码无效'
  }

  const isCodeValid = await verifyVerificationCode(
    user.email,
    input.verificationCode
  )
  if (!isCodeValid) {
    return '您的邮箱验证码无效'
  }

  const hashedPassword = await hashPassword(input.newPassword)
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword }
  })
}

export const POST = async (req: NextRequest) => {
  const input = await kunParsePostBody(req, stepTwoSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }

  const response = await stepTwo(input)
  if (typeof response === 'string') {
    return NextResponse.json(response)
  }

  return NextResponse.json({})
}
