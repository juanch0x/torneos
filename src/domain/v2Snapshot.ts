// Detached JSON-like tournament documents retain opaque fields without sharing references.
export function cloneV2Document<T>(document: T): T {
  const cloned = structuredClone(document)
  const seen = new WeakSet<object>()
  function freeze(value: unknown) {
    if (value && typeof value === 'object' && !seen.has(value)) {
      seen.add(value)
      for (const child of Object.values(value)) freeze(child)
      Object.freeze(value)
    }
  }
  freeze(cloned)
  return cloned
}
