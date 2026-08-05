import { Decoration } from '@milkdown/prose/view'
import { kunFetchFormData } from '~/utils/kunFetch'
import { checkImageValid, resizeImage } from '~/utils/resizeImage'
import { errorReporter, kunErrorHandler } from '~/utils/kunErrorHandler'
import type { Uploader } from '@milkdown/plugin-upload'
import type { Node } from '@milkdown/prose/model'

export const kunUploader: Uploader = async (files, schema) => {
  const images: File[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files.item(i)
    if (!file) {
      continue
    }

    if (!file.type.startsWith('image/')) {
      continue
    }

    if (!checkImageValid(file)) {
      continue
    }

    images.push(file)
  }

  const nodes = await Promise.all(
    images.map(async (image) => {
      const miniImage = await resizeImage(image, 1920, 1080).catch(() => null)
      if (!miniImage) return undefined

      const formData = new FormData()
      formData.append('image', miniImage)

      try {
        const res = await kunFetchFormData<
          KunResponse<{
            imageLink: string
          }>
        >('/user/image', formData)
        const alt = image.name
        let uploadedNode: Node | undefined

        kunErrorHandler(res, (value) => {
          uploadedNode = schema.nodes.image.createAndFill({
            src: value.imageLink,
            alt
          }) as Node
        })

        return uploadedNode
      } catch (error) {
        errorReporter(error)
        return undefined
      }
    })
  )

  return nodes.filter((node): node is Node => node !== undefined)
}

export const kunUploadWidgetFactory = (
  pos: number,
  spec: Parameters<typeof Decoration.widget>[2]
) => {
  const widgetDOM = document.createElement('span')
  widgetDOM.textContent = '图片正在上传中'
  widgetDOM.style.color = '#006fee'
  return Decoration.widget(pos, widgetDOM, spec)
}
