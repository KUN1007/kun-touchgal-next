'use client'

import { useState } from 'react'
import {
  Button,
  Checkbox,
  CheckboxGroup,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Snippet,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Textarea,
  useDisclosure
} from '@heroui/react'
import toast from 'react-hot-toast'
import {
  kunFetchDelete,
  kunFetchGet,
  kunFetchPost,
  kunFetchPut
} from '~/utils/kunFetch'
import { kunErrorHandler } from '~/utils/kunErrorHandler'
import type { AdminOidcClient } from '~/types/api/oidc'

const ALL_SCOPES = ['openid', 'profile', 'email', 'offline_access']
const AUTH_METHODS = [
  { key: 'client_secret_basic', label: 'client_secret_basic（机密应用）' },
  { key: 'client_secret_post', label: 'client_secret_post（机密应用）' },
  { key: 'none', label: 'none（公开应用 / SPA，需 PKCE）' }
]

const emptyForm = {
  clientName: '',
  redirectUris: '',
  postLogoutUris: '',
  scopes: ['openid', 'profile', 'email'] as string[],
  authMethod: 'client_secret_basic',
  isFirstParty: false,
  disabled: false
}

interface Props {
  initialClients: AdminOidcClient[]
}

export const OidcClientContainer = ({ initialClients }: Props) => {
  const [clients, setClients] = useState<AdminOidcClient[]>(initialClients)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [credential, setCredential] = useState<AdminOidcClient | null>(null)

  const formModal = useDisclosure()
  const credModal = useDisclosure()

  const refresh = async () => {
    const res = await kunFetchGet<AdminOidcClient[] | string>('/admin/oidc')
    if (Array.isArray(res)) {
      setClients(res)
    }
  }

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    formModal.onOpen()
  }

  const openEdit = (client: AdminOidcClient) => {
    setEditingId(client.id)
    setForm({
      clientName: client.client_name,
      redirectUris: client.redirect_uris.join('\n'),
      postLogoutUris: client.post_logout_redirect_uris.join('\n'),
      scopes: client.scopes,
      authMethod: client.token_endpoint_auth_method,
      isFirstParty: client.is_first_party,
      disabled: client.disabled
    })
    formModal.onOpen()
  }

  const showCredential = (client: AdminOidcClient) => {
    setCredential(client)
    credModal.onOpen()
  }

  const parseLines = (text: string) =>
    text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

  const handleSubmit = async () => {
    setSaving(true)
    const body = {
      client_name: form.clientName,
      redirect_uris: parseLines(form.redirectUris),
      post_logout_redirect_uris: parseLines(form.postLogoutUris),
      scopes: form.scopes,
      grant_types: form.scopes.includes('offline_access')
        ? ['authorization_code', 'refresh_token']
        : ['authorization_code'],
      token_endpoint_auth_method: form.authMethod,
      is_first_party: form.isFirstParty
    }
    const res =
      editingId === null
        ? await kunFetchPost<KunResponse<AdminOidcClient>>('/admin/oidc', body)
        : await kunFetchPut<KunResponse<AdminOidcClient>>('/admin/oidc', {
            ...body,
            id: editingId,
            disabled: form.disabled
          })
    kunErrorHandler(res, (value) => {
      toast.success(editingId === null ? '创建成功' : '保存成功')
      formModal.onClose()
      setClients((prev) => [
        value,
        ...prev.filter((item) => item.id !== value.id)
      ])
      if (editingId === null) {
        showCredential(value)
      }
    })
    setSaving(false)
  }

  const handleDelete = async (client: AdminOidcClient) => {
    if (!window.confirm(`确认删除应用「${client.client_name}」？`)) {
      return
    }
    const res = await kunFetchDelete<KunResponse<{}>>('/admin/oidc', {
      id: client.id
    })
    kunErrorHandler(res, () => {
      toast.success('已删除')
      setClients((prev) => prev.filter((item) => item.id !== client.id))
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">OIDC 应用管理</h1>
        <Button color="primary" onPress={openCreate}>
          新建应用
        </Button>
      </div>

      <Table aria-label="OIDC 应用列表">
        <TableHeader>
          <TableColumn>应用名</TableColumn>
          <TableColumn>Client ID</TableColumn>
          <TableColumn>回调地址</TableColumn>
          <TableColumn>Scope</TableColumn>
          <TableColumn>状态</TableColumn>
          <TableColumn>操作</TableColumn>
        </TableHeader>
        <TableBody emptyContent="暂无应用" items={clients}>
          {(client) => (
            <TableRow key={client.id}>
              <TableCell>{client.client_name}</TableCell>
              <TableCell>
                <span className="font-mono text-xs">{client.client_id}</span>
              </TableCell>
              <TableCell>
                <span className="text-xs text-default-500">
                  {client.redirect_uris.length} 个
                </span>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {client.scopes.map((scope) => (
                    <Chip key={scope} size="sm" variant="flat">
                      {scope}
                    </Chip>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <Chip
                  size="sm"
                  variant="flat"
                  color={client.disabled ? 'danger' : 'success'}
                >
                  {client.disabled ? '已禁用' : '启用中'}
                </Chip>
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => showCredential(client)}
                  >
                    凭据
                  </Button>
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => openEdit(client)}
                  >
                    编辑
                  </Button>
                  <Button
                    size="sm"
                    variant="flat"
                    color="danger"
                    onPress={() => handleDelete(client)}
                  >
                    删除
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Modal
        isOpen={formModal.isOpen}
        onClose={formModal.onClose}
        size="2xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader>
            {editingId === null ? '新建 OIDC 应用' : '编辑 OIDC 应用'}
          </ModalHeader>
          <ModalBody className="gap-4">
            <Input
              label="应用名称"
              value={form.clientName}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, clientName: value }))
              }
              isRequired
            />
            <Textarea
              label="回调地址 redirect_uris（每行一个）"
              placeholder="https://app.example.com/callback"
              value={form.redirectUris}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, redirectUris: value }))
              }
              minRows={2}
            />
            <Textarea
              label="登出回调 post_logout_redirect_uris（每行一个，可选）"
              value={form.postLogoutUris}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, postLogoutUris: value }))
              }
              minRows={1}
            />
            <CheckboxGroup
              label="允许的 Scope"
              orientation="horizontal"
              value={form.scopes}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, scopes: value }))
              }
            >
              {ALL_SCOPES.map((scope) => (
                <Checkbox
                  key={scope}
                  value={scope}
                  isDisabled={scope === 'openid'}
                >
                  {scope}
                </Checkbox>
              ))}
            </CheckboxGroup>
            <Select
              label="客户端认证方式"
              selectedKeys={[form.authMethod]}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, authMethod: event.target.value }))
              }
            >
              {AUTH_METHODS.map((method) => (
                <SelectItem key={method.key}>{method.label}</SelectItem>
              ))}
            </Select>
            <div className="flex gap-6">
              <Switch
                isSelected={form.isFirstParty}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, isFirstParty: value }))
                }
              >
                可信第一方
              </Switch>
              {editingId !== null && (
                <Switch
                  isSelected={form.disabled}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, disabled: value }))
                  }
                >
                  禁用
                </Switch>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={formModal.onClose}>
              取消
            </Button>
            <Button
              color="primary"
              onPress={handleSubmit}
              isLoading={saving}
              isDisabled={saving}
            >
              保存
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={credModal.isOpen} onClose={credModal.onClose} size="xl">
        <ModalContent>
          <ModalHeader>应用凭据</ModalHeader>
          <ModalBody className="gap-4 pb-6">
            {credential && (
              <>
                <div className="space-y-1">
                  <p className="text-sm text-default-500">Client ID</p>
                  <Snippet symbol="" variant="flat" className="w-full">
                    {credential.client_id}
                  </Snippet>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-default-500">Client Secret</p>
                  <Snippet symbol="" variant="flat" className="w-full">
                    {credential.client_secret}
                  </Snippet>
                </div>
                <p className="text-xs text-warning">
                  请妥善保管 Client Secret，不要泄露给第三方。Issuer 为
                  当前站点的 /oidc 路径。
                </p>
              </>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </div>
  )
}
