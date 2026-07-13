import { HomeContainer } from '~/components/home/Container'
import { kunGetActions } from './actions'

export default async function Kun() {
  const response = await kunGetActions()

  return (
    <div className="container mx-auto my-4 space-y-6">
      <HomeContainer {...response} />
    </div>
  )
}
