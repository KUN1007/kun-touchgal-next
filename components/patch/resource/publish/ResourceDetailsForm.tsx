import { Controller, useWatch } from 'react-hook-form'
import { Input, Textarea } from '@heroui/input'
import { Select, SelectItem } from '@heroui/select'
import {
  resourceTypes,
  RESOURCE_SECTION_TYPE_MAP,
  SUPPORTED_EMULATOR_TYPE,
  SUPPORTED_EMULATOR_TYPE_MAP,
  SUPPORTED_LANGUAGE,
  SUPPORTED_LANGUAGE_MAP,
  SUPPORTED_PLATFORM,
  SUPPORTED_PLATFORM_MAP
} from '~/constants/resource'
import { ControlType, ErrorType } from '../share'

interface ResourceDetailsFormProps {
  control: ControlType
  errors: ErrorType
  section: string
}

export const ResourceDetailsForm = ({
  control,
  errors,
  section
}: ResourceDetailsFormProps) => {
  const sectionTypes = RESOURCE_SECTION_TYPE_MAP[section]
  const availableTypes = sectionTypes
    ? resourceTypes.filter((type) => sectionTypes.includes(type.value))
    : resourceTypes

  const selectedTypes = useWatch({ control, name: 'type' })
  const selectedPlatforms = useWatch({ control, name: 'platform' })
  const showEmulatorType = selectedPlatforms?.includes('emulator')
  const showModelName = selectedTypes?.includes('ai')

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-medium">资源详情</h3>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <Select
              isRequired
              label="类型"
              placeholder="请选择资源的类型"
              selectionMode="multiple"
              selectedKeys={field.value}
              onSelectionChange={(key) => {
                field.onChange([...key] as string[])
              }}
              isInvalid={!!errors.type}
              errorMessage={errors.type?.message}
            >
              {availableTypes.map((type) => (
                <SelectItem key={type.value} textValue={type.label}>
                  <div className="flex flex-col">
                    <span className="text">{type.label}</span>
                    <span className="text-small text-default-500">
                      {type.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </Select>
          )}
        />

        <Controller
          name="language"
          control={control}
          render={({ field }) => (
            <Select
              isRequired
              label="语言"
              placeholder="请选择语言"
              selectionMode="multiple"
              selectedKeys={field.value}
              onSelectionChange={(key) => {
                field.onChange([...key] as string[])
              }}
              isInvalid={!!errors.language}
              errorMessage={errors.language?.message}
            >
              {SUPPORTED_LANGUAGE.map((lang) => (
                <SelectItem key={lang}>
                  {SUPPORTED_LANGUAGE_MAP[lang]}
                </SelectItem>
              ))}
            </Select>
          )}
        />

        <Controller
          name="platform"
          control={control}
          render={({ field }) => (
            <Select
              isRequired
              label="平台"
              placeholder="请选择资源的平台"
              selectionMode="multiple"
              selectedKeys={field.value}
              onSelectionChange={(key) => {
                field.onChange([...key] as string[])
              }}
              isInvalid={!!errors.platform}
              errorMessage={errors.platform?.message}
            >
              {SUPPORTED_PLATFORM.map((platform) => (
                <SelectItem key={platform}>
                  {SUPPORTED_PLATFORM_MAP[platform]}
                </SelectItem>
              ))}
            </Select>
          )}
        />

        {showEmulatorType && (
          <Controller
            name="emulatorType"
            control={control}
            render={({ field }) => (
              <Select
                isRequired
                selectionMode="multiple"
                label="模拟器类型"
                placeholder="请选择模拟器类型"
                selectedKeys={field.value}
                onSelectionChange={(keys) => {
                  field.onChange([...keys] as string[])
                }}
                isInvalid={!!errors.emulatorType}
                errorMessage={errors.emulatorType?.message}
              >
                {SUPPORTED_EMULATOR_TYPE.map((type) => (
                  <SelectItem key={type}>
                    {SUPPORTED_EMULATOR_TYPE_MAP[type]}
                  </SelectItem>
                ))}
              </Select>
            )}
          />
        )}

        {showModelName && (
          <Controller
            name="modelName"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                isRequired
                label="模型型号"
                placeholder="请填写 AI 翻译使用的模型型号, 例如 DeepSeek-V3"
                isInvalid={!!errors.modelName}
                errorMessage={errors.modelName?.message}
              />
            )}
          />
        )}
      </div>

      <Controller
        name="name"
        control={control}
        render={({ field }) => (
          <Input
            {...field}
            label="资源名称"
            placeholder="请填写您的资源名称, 例如 DeepSeek V3 翻译补丁"
            isInvalid={!!errors.name}
            errorMessage={errors.name?.message}
          />
        )}
      />

      <Controller
        name="note"
        control={control}
        render={({ field }) => (
          <Textarea
            {...field}
            label="备注"
            placeholder="您可以在此处随意添加备注, 例如资源的注意事项等"
            isInvalid={!!errors.note}
            errorMessage={errors.note?.message}
          />
        )}
      />
    </div>
  )
}
