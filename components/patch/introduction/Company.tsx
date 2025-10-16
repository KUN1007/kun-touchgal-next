'use client'

import { type FC, useState } from 'react'
import { Chip } from '@heroui/chip'
import { Tooltip } from '@heroui/tooltip'
import { Link } from '@heroui/link'
import { Company } from '~/types/api/company'
import { PatchCompanySelector } from './PatchCompanySelector'
import { useUserStore } from '~/store/userStore'

interface Props {
  patchId: number
  initialCompanies: Company[]
}

export const PatchCompany: FC<Props> = ({ patchId, initialCompanies }) => {
  const [selectedCompanies, setSelectedCompanies] = useState<Company[]>(
    initialCompanies ?? []
  )
  const user = useUserStore((state) => state.user)

  return (
    <div className="mt-4 space-y-4">
      <h2 className="text-xl font-medium">所属会社</h2>

      <div className="space-x-2">
        {selectedCompanies.map((company) => (
          <Tooltip
            key={company.id}
            content={`${company.count} 个 Galgame 属于此会社`}
          >
            <Link href={`/company/${company.id}`}>
              <Chip color="secondary" variant="flat">
                {company.name}
                {` +${company.count}`}
              </Chip>
            </Link>
          </Tooltip>
        ))}

        {!initialCompanies.length && (
          <Chip>{'这个 Galgame 本体暂未添加所属会社信息'}</Chip>
        )}
      </div>

      {user.role > 2 && (
        <PatchCompanySelector
          patchId={patchId}
          initialCompanies={selectedCompanies}
          onCompanyChange={setSelectedCompanies}
        />
      )}
    </div>
  )
}
