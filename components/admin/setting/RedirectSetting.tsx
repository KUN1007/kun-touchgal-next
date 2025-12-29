'use client'

import { Button, Card, CardBody, Chip, Input, Switch } from '@heroui/react'
import { useState } from 'react'
import { ExternalLink, Plus } from 'lucide-react'
import { kunFetchPut } from '~/utils/kunFetch'
import toast from 'react-hot-toast'
import type { AdminRedirectConfig } from '~/types/api/admin'

interface Props {
  setting: AdminRedirectConfig
}

export const RedirectSetting = ({ setting }: Props) => {
  const [delay, setDelay] = useState(setting.delaySeconds)
  const [isEnabled, setIsEnabled] = useState(setting.enableRedirect)
  const [excludedDomains, setExcludedDomains] = useState<string[]>(
    setting.excludedDomains
  )
  const [newDomain, setNewDomain] = useState('')

  const addExcludedDomain = () => {
    if (newDomain && !excludedDomains.includes(newDomain)) {
      setExcludedDomains([...excludedDomains, newDomain])
      setNewDomain('')
    }
  }

  const removeDomain = (domain: string) => {
    setExcludedDomains(excludedDomains.filter((d) => d !== domain))
  }

  const [isSetting, setIsSetting] = useState(false)
  const handleApplyRedirect = async () => {
    setIsSetting(true)
    const res = await kunFetchPut<KunResponse<{}>>('/admin/setting/redirect', {
      enableRedirect: isEnabled,
      excludedDomains,
      delaySeconds: delay
    })
    if (typeof res === 'string') {
      toast.error(res)
    } else {
      setNewDomain('')
      toast.success('应用设置成功')
    }
    setIsSetting(false)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">外链重定向</h3>
              <p className="text-small text-default-500">
                将排除列表之外的所有非本站链接重定向至跳转页
              </p>
            </div>
            <Switch
              isSelected={isEnabled}
              onValueChange={setIsEnabled}
              size="lg"
              color="primary"
              startContent={<ExternalLink className="w-4 h-4" />}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <h3 className="text-lg font-semibold">
            <p>重定向时间</p>
            <p className="text-sm font-medium text-default-500">
              重定向页面的重定向时间
            </p>
          </h3>
          <Input
            type="number"
            value={delay.toString()}
            endContent={
              <div className="flex items-center pointer-events-none">
                <span className="text-default-400 text-small">秒</span>
              </div>
            }
            onChange={(e) => setDelay(Number(e.target.value))}
          />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <h3 className="text-lg font-semibold">
            <p>排除域名列表</p>
            <p className="text-sm font-medium text-default-500">
              包含哪些域名的链接不用重定向, 例如 touchgal.top, nav.kungal.com
            </p>
          </h3>
          <div className="flex gap-2 mt-4">
            <Input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="请输入域名, 建议不带 http / https"
            />

            <Button
              isIconOnly
              variant="flat"
              color="primary"
              onPress={addExcludedDomain}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {excludedDomains.map((domain) => (
              <Chip
                key={domain}
                onClose={() => removeDomain(domain)}
                variant="flat"
                color="secondary"
              >
                {domain}
              </Chip>
            ))}
          </div>
        </CardBody>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-default-500">
          外链设置需要点击应用设置才能使设置生效
        </p>
        <Button
          variant="shadow"
          color="primary"
          onPress={handleApplyRedirect}
          isLoading={isSetting}
          isDisabled={isSetting}
        >
          应用设置
        </Button>
      </div>
    </div>
  )
}
