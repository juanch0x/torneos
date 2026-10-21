import { describe, expect, it } from 'vitest'
import { installPrintLightScheme } from '../printScheme'

type Listener = () => void

function fakeRoot(initial: string | null) {
  let value = initial
  return {
    getAttribute: (_n: string) => value,
    setAttribute: (_n: string, v: string) => {
      value = v
    },
    get value() {
      return value
    },
  }
}

function fakeWindow() {
  const win: Record<string, Set<Listener>> = {}
  const mqlListeners = new Set<Listener>()
  const mql = {
    matches: false,
    addEventListener: (_t: string, l: Listener) => mqlListeners.add(l),
    removeEventListener: (_t: string, l: Listener) => mqlListeners.delete(l),
  }
  return {
    window: {
      addEventListener: (t: string, l: Listener) => (win[t] ??= new Set()).add(l),
      removeEventListener: (t: string, l: Listener) => win[t]?.delete(l),
      matchMedia: () => mql,
    },
    fire: (t: string) => win[t]?.forEach((l) => l()),
    setPrint: (m: boolean) => {
      mql.matches = m
      mqlListeners.forEach((l) => l())
    },
    count: () => Object.values(win).reduce((n, s) => n + s.size, 0) + mqlListeners.size,
  }
}

const install = (root: ReturnType<typeof fakeRoot>, w: ReturnType<typeof fakeWindow>) =>
  installPrintLightScheme(root, w.window as unknown as Window)

describe('installPrintLightScheme', () => {
  it('forces light on beforeprint and restores on afterprint', () => {
    const root = fakeRoot('dark')
    const w = fakeWindow()
    install(root, w)
    w.fire('beforeprint')
    expect(root.value).toBe('light')
    w.fire('afterprint')
    expect(root.value).toBe('dark')
  })

  it('forces light when the print media query starts matching and restores when it stops', () => {
    const root = fakeRoot('dark')
    const w = fakeWindow()
    install(root, w)
    w.setPrint(true)
    expect(root.value).toBe('light')
    w.setPrint(false)
    expect(root.value).toBe('dark')
  })

  it('keeps the original value when both triggers fire', () => {
    const root = fakeRoot('dark')
    const w = fakeWindow()
    install(root, w)
    w.fire('beforeprint')
    w.setPrint(true)
    expect(root.value).toBe('light')
    w.fire('afterprint')
    w.setPrint(false)
    expect(root.value).toBe('dark')
  })

  it('does not restore when nothing was forced', () => {
    const root = fakeRoot('dark')
    const w = fakeWindow()
    install(root, w)
    w.fire('afterprint')
    expect(root.value).toBe('dark')
  })

  it('leaves a light page untouched', () => {
    const root = fakeRoot('light')
    const w = fakeWindow()
    install(root, w)
    w.fire('beforeprint')
    w.fire('afterprint')
    expect(root.value).toBe('light')
  })

  it('cleanup removes every listener', () => {
    const root = fakeRoot('dark')
    const w = fakeWindow()
    const cleanup = install(root, w)
    expect(w.count()).toBeGreaterThan(0)
    cleanup()
    expect(w.count()).toBe(0)
  })
})
