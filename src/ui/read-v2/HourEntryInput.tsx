import { useLayoutEffect, useRef, useState } from 'react'
import { TextInput } from '@mantine/core'
import { editHourEntry, isCompleteHourEntry } from './hourEntry'

export function HourEntryInput({ label, value, onChange, allow24 = false, disabled = false }: {
  label: string; value: string; onChange: (value: string) => void; allow24?: boolean; disabled?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const caret = useRef<number | null>(null)
  const [touched, setTouched] = useState(false)
  useLayoutEffect(() => {
    if (caret.current !== null && input.current && input.current === document.activeElement) input.current.setSelectionRange(caret.current, caret.current)
    caret.current = null
  }, [value])
  const invalid = (touched || value.length >= 5) && !isCompleteHourEntry(value, allow24)
  return <TextInput ref={input} label={label} type="text" inputMode="numeric" placeholder="HH:mm" required disabled={disabled} value={value}
    description={allow24 ? 'Formato de 24 horas; cierre hasta 24:00.' : 'Formato de 24 horas: 00:00–23:59.'}
    error={invalid ? allow24 ? 'Introduce HH:mm válido (24:00 solo al cerrar).' : 'Introduce HH:mm entre 00:00 y 23:59.' : undefined}
    inputWrapperOrder={['label', 'input', 'description', 'error']}
    onChange={event => {
      const element = event.currentTarget
      const inputType = (event.nativeEvent as InputEvent).inputType ?? 'insertText'
      const result = editHourEntry(value, element.value, element.selectionStart ?? element.value.length, inputType)
      // Also restore rejected edits when the parent value (and therefore render) does not change.
      element.value = result.value; element.setSelectionRange(result.caret, result.caret)
      caret.current = result.caret
      onChange(result.value)
    }}
    onBlur={() => {
      setTouched(true)
      // Normalize a complete four-digit value only; partial/invalid ranges remain visibly invalid.
      if (/^\d{4}$/.test(value)) onChange(`${value.slice(0, 2)}:${value.slice(2)}`)
    }} />
}
