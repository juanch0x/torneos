// "1 grupo" / "0 grupos" / "3 grupos": the count plus the right noun form.
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}
