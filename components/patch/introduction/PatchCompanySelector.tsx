'use client'

import { type FC, useEffect, useReducer, useState, useTransition } from 'react'
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure
} from '@heroui/modal'
import { Button } from '@heroui/button'
import { Chip } from '@heroui/chip'
import { Checkbox } from '@heroui/checkbox'
import { ScrollShadow } from '@heroui/scroll-shadow'
import { Link } from '@heroui/link'
import { House } from 'lucide-react'
import type { Company as CompanyType } from '~/types/api/company'
import { useDebounce } from 'use-debounce'
import { useMounted } from '~/hooks/useMounted'
import { kunFetchGet, kunFetchPost, kunFetchPut } from '~/utils/kunFetch'
import { useRouter } from '@bprogress/next'
import toast from 'react-hot-toast'
import { KunLoading } from '~/components/kun/Loading'
import { SearchCompanies } from '~/components/company/SearchCompanies'

type State = {
  selectedCompanies: number[]
  removedCompanies: number[]
  existingCompanies: number[]
}

type Action =
  | { type: 'SET_SELECTED_COMPANIES'; payload: number[] }
  | { type: 'SET_REMOVED_COMPANIES'; payload: number[] }
  | { type: 'SET_EXISTING_COMPANIES'; payload: number[] }

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_SELECTED_COMPANIES':
      return { ...state, selectedCompanies: action.payload }
    case 'SET_REMOVED_COMPANIES':
      return { ...state, removedCompanies: action.payload }
    case 'SET_EXISTING_COMPANIES':
      return { ...state, existingCompanies: action.payload }
    default:
      return state
  }
}

interface Props {
  patchId: number
  initialCompanies: CompanyType[]
  onCompanyChange: (companies: CompanyType[]) => void
}

export const PatchCompanySelector: FC<Props> = ({
  patchId,
  initialCompanies,
  onCompanyChange
}) => {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [companies, setCompanies] = useState<CompanyType[]>([])
  const [query, setQuery] = useState('')
  const [debouncedQuery] = useDebounce(query, 500)
  const isMounted = useMounted()
  const [isLoading, startFetchTransition] = useTransition()
  const [searching, startSearchTransition] = useTransition()
  const router = useRouter()

  const [state, dispatch] = useReducer(reducer, {
    selectedCompanies: [],
    removedCompanies: [],
    existingCompanies: []
  })

  useEffect(() => {
    if (!isOpen) {
      const commonIds = initialCompanies.map((company) => company.id)
      dispatch({ type: 'SET_EXISTING_COMPANIES', payload: commonIds })
      dispatch({ type: 'SET_SELECTED_COMPANIES', payload: [] })
      dispatch({ type: 'SET_REMOVED_COMPANIES', payload: [] })
    }
  }, [isOpen, initialCompanies])

  const fetchCompanies = () => {
    startFetchTransition(async () => {
      if (!isOpen) {
        return
      }
      const response = await kunFetchGet<{
        companies: CompanyType[]
        total: number
      }>('/company/all', { page: 1, limit: 100 })
      setCompanies(response.companies)
      const commonIds = initialCompanies
        .map((company) => company.id)
        .filter((id) => response.companies.some((company) => company.id === id))
      dispatch({ type: 'SET_EXISTING_COMPANIES', payload: commonIds })
    })
  }

  useEffect(() => {
    if (isMounted && isOpen) {
      fetchCompanies()
    }
  }, [isMounted, isOpen])

  const handleSearch = () => {
    startSearchTransition(async () => {
      if (!query.trim()) return
      const response = await kunFetchPost<CompanyType[]>('/company/search', {
        query: query.split(' ').filter(Boolean)
      })
      setCompanies(response)
      const commonIds = initialCompanies
        .map((company) => company.id)
        .filter((id) => response.some((company) => company.id === id))
      dispatch({ type: 'SET_EXISTING_COMPANIES', payload: commonIds })
    })
  }

  useEffect(() => {
    if (debouncedQuery) {
      handleSearch()
    } else {
      fetchCompanies()
    }
  }, [debouncedQuery])

  const toggleCompanySelection = (companyId: number, isSelected: boolean) => {
    if (isSelected) {
      if (state.existingCompanies.includes(companyId)) {
        dispatch({
          type: 'SET_REMOVED_COMPANIES',
          payload: state.removedCompanies.filter((id) => id !== companyId)
        })
      } else {
        dispatch({
          type: 'SET_SELECTED_COMPANIES',
          payload: [...state.selectedCompanies, companyId]
        })
      }
    } else {
      if (state.existingCompanies.includes(companyId)) {
        dispatch({
          type: 'SET_REMOVED_COMPANIES',
          payload: [...state.removedCompanies, companyId]
        })
      } else {
        dispatch({
          type: 'SET_SELECTED_COMPANIES',
          payload: state.selectedCompanies.filter((id) => id !== companyId)
        })
      }
    }
  }

  const handleSubmit = () => {
    startFetchTransition(async () => {
      if (!state.selectedCompanies.length && !state.removedCompanies.length) {
        return
      }
      if (state.removedCompanies.length) {
        await kunFetchPut<{}>('/patch/introduction/company', {
          patchId,
          companyId: state.removedCompanies
        })
      }

      if (state.selectedCompanies.length) {
        await kunFetchPost<{}>('/patch/introduction/company', {
          patchId,
          companyId: state.selectedCompanies
        })
      }

      const updatedCompanies = initialCompanies
        .filter((company) => !state.removedCompanies.includes(company.id))
        .concat(
          companies.filter((company) =>
            state.selectedCompanies.includes(company.id)
          )
        )
      onCompanyChange(updatedCompanies)
      router.refresh()
      toast.success('更改所属会社成功')

      dispatch({ type: 'SET_SELECTED_COMPANIES', payload: [] })
      dispatch({ type: 'SET_REMOVED_COMPANIES', payload: [] })
      onClose()
    })
  }

  return (
    <div>
      <Button
        onPress={onOpen}
        color="primary"
        variant="bordered"
        startContent={<House size={20} />}
      >
        更改所属会社
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="2xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader>更改这个 Galgame 的所属会社</ModalHeader>
          <ModalBody>
            <SearchCompanies
              query={query}
              setQuery={setQuery}
              handleSearch={handleSearch}
              searching={searching}
            />
            {!searching && (
              <ScrollShadow className="max-h-[400px]">
                {isLoading ? (
                  <KunLoading hint="正在获取会社数据..." />
                ) : (
                  <div className="space-y-2">
                    {companies.map((company) => (
                      <div
                        key={company.id}
                        className="flex items-start gap-2 p-2 rounded-lg hover:bg-default-100"
                      >
                        <Checkbox
                          isSelected={
                            state.selectedCompanies.includes(company.id) ||
                            (!state.removedCompanies.includes(company.id) &&
                              state.existingCompanies.includes(company.id))
                          }
                          onValueChange={(checked) =>
                            toggleCompanySelection(company.id, checked)
                          }
                        >
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {company.name}
                              </span>
                              <Chip size="sm" variant="flat">
                                {company.count} 个 Galgame
                              </Chip>
                            </div>
                          </div>
                        </Checkbox>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollShadow>
            )}
          </ModalBody>
          <ModalFooter className="flex-col">
            <div className="ml-auto space-x-2">
              <Button variant="flat" onPress={onClose}>
                取消
              </Button>
              <Button
                color="primary"
                onPress={handleSubmit}
                isLoading={isLoading}
                isDisabled={isLoading}
              >
                确定更改
              </Button>
            </div>
            <div>
              没有要选择的会社?&nbsp;
              <Link color="primary" showAnchorIcon href="/company">
                去创建会社
              </Link>
            </div>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
