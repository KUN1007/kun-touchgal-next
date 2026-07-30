import { Card, CardBody, CardHeader } from '@heroui/card'
import Image from 'next/image'
import { kunMoyuMoe } from '~/config/moyu-moe'

interface Props {
  title: string
  children: React.ReactNode
}

export const LoginContainer = ({ title, children }: Props) => {
  return (
    <div className="flex items-center justify-center mx-auto my-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col items-center pt-8 space-y-6">
          <div className="flex items-center space-x-2 font-medium cursor-default text-medium text-default-500">
            <Image
              src="/favicon.webp"
              priority={true}
              alt={kunMoyuMoe.titleShort}
              width={36}
              height={36}
            />
            <span>{kunMoyuMoe.titleShort}</span>
          </div>

          <h1 className="text-3xl font-bold">{title}</h1>
        </CardHeader>
        <CardBody className="flex justify-center px-8 py-6">
          {children}
        </CardBody>
      </Card>
    </div>
  )
}
