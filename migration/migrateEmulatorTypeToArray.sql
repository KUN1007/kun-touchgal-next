-- emulator_type 从单选 varchar 改为多选 text[]
-- 已有非空字符串包成单元素数组, 空字符串转为空数组
ALTER TABLE patch_resource
  ALTER COLUMN emulator_type DROP DEFAULT,
  ALTER COLUMN emulator_type TYPE text[]
    USING CASE
      WHEN emulator_type = '' THEN '{}'::text[]
      ELSE ARRAY[emulator_type]::text[]
    END;
