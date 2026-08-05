import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendKunEmail } from '~/app/api/utils/sendKunEmail'

const SEND_EMAIL_ERROR = '邮件发送失败, 请稍后重试'

const payload = {
  to: ['test@example.com'],
  subject: '测试邮件',
  tag: 'test-tag',
  html_body: '<p>html</p>',
  plain_body: 'plain'
}

const upstreamErrorBody =
  '{"status":"error","data":{"code":"InvalidServerAPIKey"}}'

describe('sendKunEmail', () => {
  const fetchMock = vi.fn()
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    fetchMock.mockReset()
  })

  it('returns undefined on success', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'success' })
    })

    const result = await sendKunEmail(payload)

    expect(result).toBeUndefined()
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('passes a timeout signal to fetch', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'success' })
    })

    await sendKunEmail(payload)

    const [, init] = fetchMock.mock.calls[0]
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('returns a fixed message and logs when the response is not ok', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => upstreamErrorBody
    })

    const result = await sendKunEmail(payload)

    expect(result).toBe(SEND_EMAIL_ERROR)
    expect(result).not.toContain('InvalidServerAPIKey')
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to send email:',
      expect.objectContaining({ tag: 'test-tag', status: 401 })
    )
  })

  it('returns a fixed message and logs when the relay reports an error status', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'error', data: { code: 'NoRecipients' } })
    })

    const result = await sendKunEmail(payload)

    expect(result).toBe(SEND_EMAIL_ERROR)
    expect(result).not.toContain('NoRecipients')
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to send email:',
      expect.objectContaining({ tag: 'test-tag' })
    )
  })

  it('returns a fixed message and logs when fetch rejects', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))

    const result = await sendKunEmail(payload)

    expect(result).toBe(SEND_EMAIL_ERROR)
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to send email:',
      expect.objectContaining({ tag: 'test-tag' })
    )
  })

  it('returns a fixed message when the response body is not valid JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token')
      }
    })

    const result = await sendKunEmail(payload)

    expect(result).toBe(SEND_EMAIL_ERROR)
    expect(errorSpy).toHaveBeenCalled()
  })
})
