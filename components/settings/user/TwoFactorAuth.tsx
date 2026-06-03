'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Switch,
  useDisclosure
} from '@heroui/react'
import { useUserStore } from '~/store/userStore'
import { kunFetchGet, kunFetchPost } from '~/utils/kunFetch'
import toast from 'react-hot-toast'
import { useMounted } from '~/hooks/useMounted'
import { kunErrorHandler } from '~/utils/kunErrorHandler'

interface AuthStatus {
  isEnabled2FA: boolean
  hasSecret: boolean
  backupCodeLength: number
  secret: string
  authUrl: string
  qrCodeUrl: string
  token: string
  backupCode: string[]
}

export const TwoFactorAuth = () => {
  const user = useUserStore((state) => state.user)
  const isMounted = useMounted()
  const [isPending, startTransition] = useTransition()

  const initialStatus: AuthStatus = {
    isEnabled2FA: false,
    hasSecret: false,
    backupCodeLength: 0,
    secret: '',
    authUrl: '',
    qrCodeUrl: '',
    token: '',
    backupCode: [] as string[]
  }
  const [authStatus, setAuthStatus] = useState<AuthStatus>(initialStatus)

  const { isOpen, onOpen, onClose } = useDisclosure()
  const {
    isOpen: isBackupOpen,
    onOpen: onBackupOpen,
    onClose: onBackupClose
  } = useDisclosure()
  const {
    isOpen: isDisableOpen,
    onOpen: onDisableOpen,
    onClose: onDisableClose
  } = useDisclosure()
  const [disableToken, setDisableToken] = useState('')
  const [isUsingBackupCode, setIsUsingBackupCode] = useState(false)

  useEffect(() => {
    const check2FAStatus = async () => {
      const response = await kunFetchGet<{
        enabled: boolean
        hasSecret: boolean
        backupCodeLength: number
      }>('/user/setting/2fa/status')
      setAuthStatus((current) => ({
        ...current,
        isEnabled2FA: response.enabled,
        hasSecret: response.hasSecret,
        backupCodeLength: response.backupCodeLength
      }))
    }

    if (isMounted) {
      check2FAStatus()
    }
  }, [isMounted])

  const generateSecret = async () => {
    if (!user.uid) {
      toast.error('请登陆后再启用 2FA')
      return
    }

    startTransition(async () => {
      const res = await kunFetchPost<
        KunResponse<{
          secret: string
          authUrl: string
          qrCodeUrl: string
        }>
      >('/user/setting/2fa/save-secret')

      kunErrorHandler(res, (value) => {
        setAuthStatus((current) => ({
          ...current,
          secret: value.secret,
          authUrl: value.authUrl,
          qrCodeUrl: value.qrCodeUrl,
          hasSecret: true,
          backupCodeLength: 0
        }))
        onOpen()
        toast.success('密钥已生成，请使用身份验证器应用扫描二维码')
      })
    })
  }

  const verifyAndEnable = async () => {
    if (!authStatus.token) {
      toast.error('请输入验证码')
      return
    }

    startTransition(async () => {
      const res = await kunFetchPost<KunResponse<{ backupCode: string[] }>>(
        '/user/setting/2fa/enable',
        { token: authStatus.token }
      )

      kunErrorHandler(res, (value) => {
        setAuthStatus((current) => ({
          ...current,
          isEnabled2FA: true,
          backupCodeLength: value.backupCode.length,
          backupCode: value.backupCode
        }))
        onClose()
        onBackupOpen()
        toast.success('两步验证已启用')
      })
    })
  }

  const closeDisableModal = () => {
    setDisableToken('')
    setIsUsingBackupCode(false)
    onDisableClose()
  }

  const disable2FA = async () => {
    const token = disableToken.trim()
    if (!token) {
      toast.error('请输入验证码')
      return
    }

    startTransition(async () => {
      const res = await kunFetchPost<KunResponse<{}>>(
        '/user/setting/2fa/disable',
        {
          token,
          isBackupCode: isUsingBackupCode
        }
      )

      kunErrorHandler(res, () => {
        setAuthStatus(initialStatus)
        closeDisableModal()
        toast.success('两步验证已禁用')
      })
    })
  }

  return (
    <>
      <Card className="w-full text-sm">
        <CardHeader>
          <h2 className="text-xl font-medium">两步验证</h2>
        </CardHeader>
        <CardBody className="py-0 space-y-4">
          <div>
            <p>
              两步验证可以为您的账户提供额外的安全保护。启用后，每次登录时除了密码外，
              还需要输入身份验证器应用生成的验证码。{' '}
              <b>您当前还有 {authStatus.backupCodeLength} 个备用验证码</b>,
              当备用验证码过少时, 建议您重新进行两步验证
            </p>
          </div>
          <div className="flex items-center justify-between">
            <p>是否启用两步验证</p>
            <Switch
              size="lg"
              color="primary"
              isSelected={authStatus.isEnabled2FA}
              isDisabled={isPending}
              onValueChange={(value) => {
                if (value) {
                  generateSecret()
                } else {
                  onDisableOpen()
                }
              }}
            />
          </div>
        </CardBody>

        <CardFooter className="flex-wrap">
          <p className="text-default-500">
            启用两步验证后，即使密码泄露，他人也无法登录您的账户
          </p>
        </CardFooter>
      </Card>

      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalContent>
          <ModalHeader>设置两步验证</ModalHeader>
          <ModalBody>
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-lg font-medium">步骤 1: 扫描二维码</h3>
                <p className="text-sm text-default-500">
                  使用 Google Authenticator、Microsoft Authenticator
                  或其他身份验证器应用扫描下方的二维码
                </p>
                {authStatus.qrCodeUrl && (
                  <div className="flex justify-center my-4">
                    <img
                      src={authStatus.qrCodeUrl}
                      alt="2FA QR Code"
                      width={200}
                      height={200}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-medium">步骤 2: 输入验证码</h3>
                <p className="text-sm text-default-500">
                  打开身份验证器应用，输入显示的 6 位验证码
                </p>
                <Input
                  value={authStatus.token}
                  onValueChange={(value) =>
                    setAuthStatus({ ...authStatus, token: value })
                  }
                  placeholder="6位验证码"
                  maxLength={6}
                  className="text-lg tracking-widest text-center"
                />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-medium">密钥</h3>
                <p className="text-sm text-default-500">
                  如果无法扫描二维码，您可以手动将此密钥输入到身份验证器应用中
                </p>
                <div className="flex gap-2">
                  <Input
                    value={authStatus.secret}
                    readOnly
                    className="font-mono"
                  />
                  <Button
                    color="primary"
                    variant="flat"
                    onPress={() => {
                      navigator.clipboard.writeText(authStatus.secret)
                      toast.success('密钥已复制到剪贴板')
                    }}
                  >
                    复制
                  </Button>
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={onClose}>
              取消
            </Button>
            <Button
              color="primary"
              onPress={verifyAndEnable}
              isLoading={isPending}
              isDisabled={isPending || !authStatus.token}
            >
              验证并启用
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isDisableOpen} onClose={closeDisableModal} size="md">
        <ModalContent>
          <ModalHeader>关闭两步验证</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <p className="text-sm text-default-500">
                请输入身份验证器应用中的 6 位验证码，或使用一个备用验证码。
              </p>
              <Input
                value={disableToken}
                onValueChange={setDisableToken}
                placeholder={
                  isUsingBackupCode ? '输入备用验证码' : '输入 6 位验证码'
                }
                maxLength={6}
                className="text-lg text-center"
              />
              <button
                type="button"
                className="relative inline-flex items-center text-medium text-primary no-underline transition-opacity outline-hidden tap-highlight-transparent hover:opacity-hover active:opacity-disabled disabled:cursor-not-allowed disabled:opacity-disabled focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
                onClick={() => {
                  setIsUsingBackupCode((value) => !value)
                  setDisableToken('')
                }}
                disabled={isPending}
              >
                {isUsingBackupCode ? '使用身份验证器验证码' : '使用备用验证码'}
                <svg
                  aria-hidden="true"
                  fill="none"
                  focusable="false"
                  height="1em"
                  shapeRendering="geometricPrecision"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  viewBox="0 0 24 24"
                  width="1em"
                  className="self-center flex mx-1 text-current"
                >
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                  <path d="M15 3h6v6" />
                  <path d="M10 14L21 3" />
                </svg>
              </button>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              color="danger"
              variant="light"
              onPress={closeDisableModal}
              isDisabled={isPending}
            >
              取消
            </Button>
            <Button
              color="danger"
              onPress={disable2FA}
              isLoading={isPending}
              isDisabled={isPending || !disableToken.trim()}
            >
              验证并关闭
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        isDismissable={false}
        isOpen={isBackupOpen}
        onClose={onBackupClose}
        size="lg"
      >
        <ModalContent>
          <ModalHeader>备用验证码</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <p className="text-sm text-default-500">
                请保存这些备用验证码，每个代码只能使用一次。如果您无法使用身份验证器应用，可以使用这些备用码登录
              </p>
              <div className="grid grid-cols-3 gap-2">
                {authStatus.backupCode.map((code, index) => (
                  <Chip
                    key={index}
                    className="p-2 mx-auto font-mono text-center"
                    variant="flat"
                  >
                    {code}
                  </Chip>
                ))}
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              color="primary"
              onPress={() => {
                navigator.clipboard.writeText(authStatus.backupCode.join('\n'))
                toast.success('备用验证码已复制到剪贴板')
              }}
            >
              复制所有代码
            </Button>
            <Button color="primary" onPress={onBackupClose}>
              完成
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}
