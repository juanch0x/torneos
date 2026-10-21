import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ErrorIcon, LockIcon, MoonIcon, SuccessIcon, SunIcon, WarningIcon } from '../icons'

const ICONS = { WarningIcon, ErrorIcon, SuccessIcon, LockIcon, SunIcon, MoonIcon }

describe('state icons', () => {
  it.each(Object.entries(ICONS))('%s is a decorative svg that inherits the text color', (_name, Icon) => {
    const html = renderToStaticMarkup(<Icon />)
    expect(html).toMatch(/^<svg\b/)
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('focusable="false"')
    expect(html).toContain('stroke="currentColor"')
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb/)
  })

  it('uses a distinct shape per state so grayscale still tells them apart', () => {
    const shapes = Object.values(ICONS).map((Icon) => renderToStaticMarkup(<Icon />))
    expect(new Set(shapes).size).toBe(shapes.length)
  })

  it('honours size and the inline spacing flag', () => {
    expect(renderToStaticMarkup(<WarningIcon size={20} />)).toContain('width="20"')
    expect(renderToStaticMarkup(<WarningIcon inline />)).toContain('margin-inline-end')
    expect(renderToStaticMarkup(<WarningIcon />)).not.toContain('margin-inline-end')
  })
})
