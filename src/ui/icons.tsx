import type { CSSProperties, ReactNode } from 'react'

// Inline state icons. They are decorative (aria-hidden): the adjacent text stays the accessible name.
// Strokes use currentColor so they follow the text, Alert or Badge color of the host.
interface IconProps {
  size?: number
  /** Adds spacing and baseline alignment for use inside running text. */
  inline?: boolean
}

function Svg({ size = 16, inline = false, children }: IconProps & { children: ReactNode }) {
  const style: CSSProperties | undefined = inline ? { marginInlineEnd: 6, verticalAlign: '-0.15em', flexShrink: 0 } : undefined
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      {children}
    </svg>
  )
}

/** Triangle with an exclamation mark. */
export const WarningIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 3 2.5 20h19L12 3Z" />
    <path d="M12 10v4.5M12 17.5h.01" />
  </Svg>
)

/** Circle with a cross. */
export const ErrorIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="m8.5 8.5 7 7m0-7-7 7" />
  </Svg>
)

/** Circle with a check mark. */
export const SuccessIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="m8 12.5 3 3 5-6" />
  </Svg>
)

/** Padlock. */
export const LockIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </Svg>
)
