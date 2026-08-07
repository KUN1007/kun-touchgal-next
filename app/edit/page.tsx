import { redirect } from 'next/navigation'
import { verifyHeaderCookie } from '~/utils/actions/verifyHeaderCookie'

export default async function Kun() {
  const payload = await verifyHeaderCookie()

  if (!payload) {
    redirect(`/login?from=${encodeURIComponent('/edit')}`)
  }

  if (payload.role >= 4) {
    redirect('/edit/create')
  }

  redirect('/')
}
