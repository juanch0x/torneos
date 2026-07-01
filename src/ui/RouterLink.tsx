import { Anchor, type AnchorProps } from '@mantine/core'
import { createLink } from '@tanstack/react-router'
import { forwardRef } from 'react'

const MantineAnchorLink = forwardRef<HTMLAnchorElement, AnchorProps>((props, ref) => (
  <Anchor ref={ref} {...props} />
))

/** Mantine Anchor wired to the typed TanStack router Link (preserves route param/search typing). */
export const RouterLink = createLink(MantineAnchorLink)
