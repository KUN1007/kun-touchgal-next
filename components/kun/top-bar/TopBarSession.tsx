import { KunTopBar } from './TopBar'
import type { UserSession } from '~/types/api/session'

interface Props {
  initialSession: Promise<UserSession | null>
}

export const KunTopBarSession = async ({ initialSession }: Props) => {
  const session = await initialSession
  return <KunTopBar initialSession={session} />
}
