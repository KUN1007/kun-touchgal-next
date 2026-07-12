'use client'

import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Button } from '@heroui/button'
import { iconVariants, textVariants, toastVariants } from '~/motion/sooner'
import { loliAttribute } from './utils/loli'
import Image from 'next/image'
import { Chip } from '@heroui/react'
import type { Toast } from 'react-hot-toast'

interface ToastProps {
  message: string
  t: Toast
}

const { loli, name } = loliAttribute

export const KunSoonerToast = ({ message, t }: ToastProps) => {
  return (
    <motion.div
      variants={toastVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex justify-center w-full"
    >
      <div className="flex w-full max-w-md p-2 shadow-lg pointer-events-auto rounded-2xl bg-background ring-1 ring-foreground/5">
        <div className="flex-1 w-0 p-4">
          <div className="flex items-start">
            <motion.div
              variants={iconVariants}
              initial="initial"
              animate="animate"
              className="shrink-0"
            >
              <Image
                src={loli}
                alt={name}
                width={50}
                height={50}
                className="w-16"
              />
            </motion.div>

            <motion.div
              variants={textVariants}
              initial="initial"
              animate="animate"
              className="relative flex-1 h-full ml-3 space-y-2"
            >
              <Chip
                color="primary"
                variant="shadow"
                className="absolute -left-12 -top-10"
                size="lg"
              >
                {name}
              </Chip>
              <p className="flex items-center font-medium">{message}</p>
            </motion.div>
          </div>
        </div>
        <div className="flex">
          <Button
            isIconOnly
            variant="light"
            className="flex items-center justify-center"
            onPress={() => toast.remove(t.id)}
          >
            <motion.div
              whileHover={{ rotate: 90 }}
              transition={{ duration: 0.2 }}
            >
              <X className="size-5" />
            </motion.div>
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
