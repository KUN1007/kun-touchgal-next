import { defaultValueCtx, Editor, rootCtx } from '@milkdown/core'
import { Milkdown, useEditor } from '@milkdown/react'
import { commonmark } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { history } from '@milkdown/plugin-history'
import { prism, prismConfig } from '@milkdown/plugin-prism'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { clipboard } from '@milkdown/plugin-clipboard'
import { indent } from '@milkdown/plugin-indent'
import { trailing } from '@milkdown/plugin-trailing'
import { upload, uploadConfig } from '@milkdown/plugin-upload'
import { kunUploader, kunUploadWidgetFactory } from './plugins/uploader'
import { automd } from '@milkdown/plugin-automd'

import { KunMilkdownPluginsMenu } from './plugins/Menu'
import { KunLoading } from '../Loading'
import '~/styles/editor.scss'

import bash from 'refractor/lang/bash'
import c from 'refractor/lang/c'
import cpp from 'refractor/lang/cpp'
import csharp from 'refractor/lang/csharp'
import css from 'refractor/lang/css'
import go from 'refractor/lang/go'
import haskell from 'refractor/lang/haskell'
import python from 'refractor/lang/python'
import java from 'refractor/lang/java'
import javascript from 'refractor/lang/javascript'
import jsx from 'refractor/lang/jsx'
import json from 'refractor/lang/json'
import kotlin from 'refractor/lang/kotlin'
import r from 'refractor/lang/r'
import rust from 'refractor/lang/rust'
import scala from 'refractor/lang/scala'
import sql from 'refractor/lang/sql'
import tsx from 'refractor/lang/tsx'
import typescript from 'refractor/lang/typescript'
import markdown from 'refractor/lang/markdown'

type Props = {
  valueMarkdown: string
  saveMarkdown: (markdown: string) => void
}

export const KunEditor = ({ valueMarkdown, saveMarkdown }: Props) => {
  const editor = useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, valueMarkdown)

        const listener = ctx.get(listenerCtx)
        listener.markdownUpdated((_, markdown) => {
          saveMarkdown(markdown)
        })

        ctx.update(uploadConfig.key, (prev) => ({
          ...prev,
          uploader: kunUploader,
          uploadWidgetFactory: kunUploadWidgetFactory
        }))

        ctx.set(prismConfig.key, {
          configureRefractor: (refractor) => {
            refractor.register(c)
            refractor.register(bash)
            refractor.register(cpp)
            refractor.register(csharp)
            refractor.register(css)
            refractor.register(go)
            refractor.register(haskell)
            refractor.register(python)
            refractor.register(markdown)
            refractor.register(java)
            refractor.register(javascript)
            refractor.register(json)
            refractor.register(jsx)
            refractor.register(kotlin)
            refractor.register(r)
            refractor.register(rust)
            refractor.register(scala)
            refractor.register(sql)
            refractor.register(tsx)
            refractor.register(typescript)
          }
        })
      })
      .use(history)
      .use(commonmark)
      .use(gfm)
      .use(prism)
      .use(listener)
      .use(clipboard)
      .use(indent)
      .use(trailing)
      .use(upload)
      .use(automd)
  )

  return (
    <div className="min-h-64" onClick={(e) => e.stopPropagation()}>
      <KunMilkdownPluginsMenu editorInfo={editor} />
      <Milkdown />
      {editor.loading && (
        <KunLoading className="min-h-48" hint="正在加载编辑器" />
      )}
    </div>
  )
}
