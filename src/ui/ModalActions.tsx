import type { ReactNode } from 'react'
import { Flex } from '@mantine/core'

/** Keep secondary actions before the primary action in DOM and visual order. */
export function ModalActions({ children }: { children: ReactNode }) {
  return (
    <Flex
      direction={{ base: 'column', sm: 'row' }}
      align={{ base: 'stretch', sm: 'center' }}
      justify="flex-end"
      gap="sm"
      mt="sm"
      w="100%"
      wrap="wrap"
    >
      {children}
    </Flex>
  )
}
