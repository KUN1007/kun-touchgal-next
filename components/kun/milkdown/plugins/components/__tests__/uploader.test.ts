import { beforeEach, describe, expect, it, vi } from 'vitest'

const { toastErrorMock, kunFetchFormDataMock, resizeImageMock } = vi.hoisted(
  () => ({
    toastErrorMock: vi.fn(),
    kunFetchFormDataMock: vi.fn(),
    resizeImageMock: vi.fn()
  })
)

vi.mock('react-hot-toast', () => ({
  default: { error: toastErrorMock }
}))

vi.mock('@milkdown/prose/view', () => ({
  Decoration: { widget: vi.fn() }
}))

vi.mock('~/utils/kunFetch', () => ({
  kunFetchFormData: kunFetchFormDataMock
}))

vi.mock('~/utils/resizeImage', () => ({
  resizeImage: resizeImageMock
}))

import { kunUploader } from '~/components/kun/milkdown/plugins/components/uploader'

const createAndFillMock = vi.fn((attrs: { src: string; alt: string }) => ({
  ...attrs
}))

const schema = {
  nodes: { image: { createAndFill: createAndFillMock } }
} as unknown as Parameters<typeof kunUploader>[1]

const makeFileList = (files: File[]) =>
  ({
    length: files.length,
    item: (i: number) => files[i] ?? null
  }) as unknown as FileList

const makeImage = (name: string) => new File(['x'], name, { type: 'image/png' })

const upload = (files: File[]) =>
  kunUploader(makeFileList(files), schema, undefined as never, 0)

beforeEach(() => {
  vi.clearAllMocks()
  resizeImageMock.mockResolvedValue(new Blob(['mini']))
})

describe('kunUploader', () => {
  it('业务错误字符串响应时返回空数组而非 [undefined]', async () => {
    kunFetchFormDataMock.mockResolvedValue('您今日上传的图片已达到 50 张限额')

    const nodes = await upload([makeImage('a.png')])

    expect(nodes).toEqual([])
    expect(createAndFillMock).not.toHaveBeenCalled()
    expect(toastErrorMock).toHaveBeenCalledWith(
      '您今日上传的图片已达到 50 张限额'
    )
  })

  it('部分成功时只返回成功节点, 不含 undefined', async () => {
    kunFetchFormDataMock
      .mockResolvedValueOnce({ imageLink: 'https://img.kun/a.avif' })
      .mockResolvedValueOnce('您今日上传的图片已达到 50 张限额')

    const nodes = await upload([makeImage('a.png'), makeImage('b.png')])

    expect(nodes).toEqual([{ src: 'https://img.kun/a.avif', alt: 'a.png' }])
    expect(toastErrorMock).toHaveBeenCalledTimes(1)
  })

  it('单图网络异常不影响其余图片且弹出 toast', async () => {
    kunFetchFormDataMock
      .mockRejectedValueOnce(new Error('Kun Fetch error! Status: 500'))
      .mockResolvedValueOnce({ imageLink: 'https://img.kun/b.avif' })

    const nodes = await upload([makeImage('a.png'), makeImage('b.png')])

    expect(nodes).toEqual([{ src: 'https://img.kun/b.avif', alt: 'b.png' }])
    expect(toastErrorMock).toHaveBeenCalledWith('图片 a.png 上传失败')
  })
})
