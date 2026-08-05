import crypto from 'crypto'
import { setKv } from '~/lib/redis'
import { kunMoyuMoe } from '~/config/moyu-moe'
import { emailTemplates } from '~/constants/email/group-templates'
import { sendKunEmail } from '~/app/api/utils/sendKunEmail'

const CACHE_KEY = 'auth:mail:notice'

const getEmailSubject = (selectedTemplate: string) => {
  const currentTemplate = emailTemplates.find((t) => t.id === selectedTemplate)
  if (!currentTemplate) {
    return kunMoyuMoe.titleShort
  }
  return `${kunMoyuMoe.titleShort} - ${currentTemplate.name}`
}

const getPreviewContent = (
  selectedTemplate: string,
  templateVars: Record<string, string>,
  email: string,
  validateEmailCode: string
) => {
  const currentTemplate = emailTemplates.find((t) => t.id === selectedTemplate)
  if (!currentTemplate) {
    return ''
  }

  const variables = {
    ...templateVars,
    email,
    validateEmailCode
  }

  let content = currentTemplate.template
  Object.entries(variables).forEach(([key, value]) => {
    content = content.replace(new RegExp(`{{${key}}}`, 'g'), value)
  })

  return content
}

export const sendEmailHTML = async (
  templateId: string,
  variables: Record<string, string>,
  email: string
) => {
  const validateEmailCode = crypto.randomUUID()

  await setKv(`${CACHE_KEY}:${email}`, validateEmailCode, 7 * 24 * 60 * 60)

  const content = getPreviewContent(
    templateId,
    variables,
    email,
    validateEmailCode
  )

  return sendKunEmail({
    to: [email],
    subject: getEmailSubject(templateId),
    tag: templateId,
    html_body: content,
    plain_body: '请在支持 HTML 的邮件客户端中查看此邮件'
  })
}
