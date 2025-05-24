import { Toaster } from 'react-hot-toast'
import { Providers } from './providers'
import { KunTopBar } from '~/components/kun/top-bar/TopBar'
import { KunFooter } from '~/components/kun/Footer'
import { KunNavigationBreadcrumb } from '~/components/kun/NavigationBreadcrumb'
import { generateKunMetadata, kunViewport } from './metadata'
import { KunBackToTop } from '~/components/kun/BackToTop'
import type { Metadata, Viewport } from 'next'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import '~/styles/index.scss'
import './actions'

export const viewport: Viewport = kunViewport
export const metadata: Metadata = generateKunMetadata()

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-Hans" suppressHydrationWarning>
      {process.env.KUN_VISUAL_NOVEL_TEST_SITE_LABEL && (
        <head>
          <meta name="robots" content="noindex,nofollow" />
          <meta name="googlebot" content="noindex,nofollow" />
        </head>
      )}

      <body>
        <Providers>
          <NuqsAdapter>
            <div className="relative flex flex-col items-center justify-center min-h-screen bg-radial">
              <KunTopBar />
              <KunNavigationBreadcrumb />
              <div className="flex min-h-[calc(100dvh-256px)] w-full max-w-7xl grow px-3 sm:px-6">
                {children}
                <Toaster />
              </div>
              <KunBackToTop />
              <KunFooter />
            </div>
          </NuqsAdapter>
        </Providers>
      </body>
    </html>
  )
}
