'use client'

import { Card, CardBody } from '@heroui/card'
import { Chip } from '@heroui/chip'
import { Link } from '@heroui/link'
import { Tooltip } from '@heroui/tooltip'
import { Heart } from 'lucide-react'
import { formatTimeDifference } from '~/utils/time'
import type { UserComment } from '~/types/api/user'

interface Props {
  comment: UserComment
}

export const UserCommentCard = ({ comment }: Props) => {
  return (
    <Card>
      <CardBody className="space-y-2">
        {comment.quotedUserUid && (
          <h4 className="space-x-2">
            <span className="text-default-500">回复给</span>
            <Link href={`/user/${comment.quotedUserUid}/resource`}>
              {comment.quotedUsername}
            </Link>
          </h4>
        )}

        <p>{comment.content}</p>

        <div className="flex items-center justify-between text-default-500">
          <span className="text-sm text-muted-foreground">
            发布于 {formatTimeDifference(comment.created)}
          </span>

          <Tooltip content="点赞数">
            <Chip
              startContent={<Heart className="size-4" />}
              variant="light"
              size="sm"
              className="gap-2 text-default-500"
            >
              {comment.like}
            </Chip>
          </Tooltip>
        </div>

        <div className="text-sm text-default-500">
          位置{' '}
          <Link size="sm" underline="always" href={`/${comment.patchUniqueId}`}>
            {comment.patchName}
          </Link>
        </div>
      </CardBody>
    </Card>
  )
}
