import { HourEntryInput } from './HourEntryInput'
import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { ActionIcon, Alert, Badge, Button, Fieldset, Group, Modal, SimpleGrid, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { applyV2Configuration, getV2ConfigurationDraft, hasCompleteV2Configuration, v2ConfigurationIssues, type V2ConfigurationDraft } from '../../domain/v2Configuration'
import { v2SessionStore } from '../../store/v2Session'
import { v2SessionController } from '../../router/v2SessionController'
import { plural } from '../../domain/text'

export function V2ConfigurationHeader({ tournamentId }: { tournamentId: string }) {
  const state = useStore(v2SessionStore)
  const [editing, setEditing] = useState<{ initial: V2ConfigurationDraft; epoch: number } | null>(null)
  const [notice, setNotice] = useState('')
  useEffect(() => { setEditing(null); setNotice('') }, [tournamentId, state.draftDiscardRevision])
  const source = state.sourceId === tournamentId && state.status === 'loaded' ? state.working : null
  const ready = hasCompleteV2Configuration(source)
  const issues = source ? v2ConfigurationIssues(source) : []
  const selected = state.sources.find(item => item.id === tournamentId)
  const title = source?.name ?? selected?.name ?? (state.status === 'loading' ? 'Cargando torneo…' : state.status === 'not-found' ? 'Torneo no disponible' : 'Torneo seleccionado')
  return <Stack gap="xs">
    <Group justify="space-between" wrap="nowrap">
      <Group gap="sm" style={{ flex: 1, minWidth: 0 }}><Text fw={700} size="lg" style={{ overflowWrap: 'anywhere' }}>{title}</Text>{source && !ready && <Badge color="orange" variant="light">Necesita configuración</Badge>}</Group>
      <Tooltip label="Configurar torneo" withArrow><ActionIcon size={44} style={{ flexShrink: 0 }} variant="subtle" disabled={!source || state.saving || state.draftDirty || state.writeUncertain || state.navigationBlocked} aria-label="Configurar torneo" onClick={() => {
        const current = v2SessionStore.getState()
        if (current.sourceId === tournamentId && current.working) setEditing({ initial: getV2ConfigurationDraft(current.working), epoch: current.epoch })
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 2h4l.7 3 2.1 1.2 2.9-.9 2 3.4-2.2 2.1v2.4l2.2 2.1-2 3.4-2.9-.9-2.1 1.2-.7 3h-4l-.7-3-2.1-1.2-2.9.9-2-3.4 2.2-2.1v-2.4l-2.2-2.1 2-3.4 2.9.9L9.3 5Z" /><circle cx="12" cy="12" r="3" /></svg>
      </ActionIcon></Tooltip>
    </Group>
    {source && !ready && <Text size="sm" c="orange.8">Completa y guarda fechas, Disponibilidad de la cancha, Horario del torneo, Días del torneo y duración desde el engranaje para editar restricciones o abrir el calendario.</Text>}
    {(state.saving || notice || !source) && <Text role="status" aria-live="polite" size="sm">{state.saving ? 'Guardando…' : notice || (state.status === 'loading' ? 'Leyendo el torneo seleccionado…' : state.status === 'not-found' ? 'No se encontró esta fuente.' : state.status === 'error' ? 'No se pudo cargar esta fuente.' : 'Selecciona o carga este torneo para configurarlo.')}</Text>}
    {!!issues.length && <details><summary>{plural(issues.length, 'registro requiere', 'registros requieren')} revisión · Horarios intactos</summary><Stack mt="xs" gap={4} style={{ maxHeight: 180, overflowY: 'auto' }}>{issues.map((issue, index) => <Text size="xs" key={index} c="orange.8">{issue.message}</Text>)}</Stack></details>}
    {editing && <ConfigurationModal initial={editing.initial} epoch={editing.epoch} tournamentId={tournamentId} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setNotice('Configuración guardada. Restricciones y horarios intactos.') }} />}
  </Stack>
}
function ConfigurationModal({ initial, epoch, tournamentId, onClose, onSaved }: { initial: V2ConfigurationDraft; epoch: number; tournamentId: string; onClose: () => void; onSaved: () => void }) {
  const state = useStore(v2SessionStore)
  const [draft, setDraft] = useState(initial)
  const [discard, setDiscard] = useState(false)
  const [error, setError] = useState('')
  const dirty = JSON.stringify(initial) !== JSON.stringify(draft)
  useEffect(() => { v2SessionStore.setState({ draftDirty: dirty }) }, [dirty])
  useEffect(() => () => { v2SessionStore.setState({ draftDirty: false }) }, [])
  const validation = state.working ? applyV2Configuration(state.working, draft) : { ok: false as const, error: 'Fuente no disponible.' }
  const impacts = validation.ok ? v2ConfigurationIssues(validation.document) : []
  function close() { if (v2SessionStore.getState().saving || discard) return; if (dirty) setDiscard(true); else onClose() }
  function field(key: Exclude<keyof V2ConfigurationDraft,'automaticWeekdays'>, label: string, type = 'text', description?: string) {
    return <TextInput label={label} description={description} inputWrapperOrder={['label', 'input', 'description', 'error']} type={type} required disabled={state.saving} value={draft[key]} onChange={event => { const value = event.currentTarget.value; setDraft(current => ({ ...current, [key]: value })); setError('') }} {...(key === 'duration' ? { min: 1, step: 1 } : {})} />
  }
  return <><Modal opened onClose={close} centered title="Configurar torneo" size="lg" closeOnEscape={!state.saving && !discard && !state.navigationBlocked} closeOnClickOutside={!state.saving && !discard} trapFocus={!discard && !state.navigationBlocked} closeButtonProps={{ disabled: state.saving, 'aria-label': 'Cancelar configuración' }}>
    <form onSubmit={async event => {
      event.preventDefault(); if (v2SessionStore.getState().saving) return
      setError('')
      const result = await v2SessionController.saveConfiguration(draft, { sourceId: tournamentId, epoch })
      if (result.ok) onSaved(); else setError(result.error)
    }}><Stack gap="md">
      <Text size="sm">Define el período, la disponibilidad física y el horario de generación. Guardar no genera ni reprograma partidos y no elimina restricciones.</Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>{field('startDate', 'Primer día del período', 'date')}{field('endDate', 'Último día del período', 'date')}</SimpleGrid>
      <V2HourWindowsFields draft={draft} disabled={state.saving} legacy={state.working?.fixtureSettings?.automaticWindow === undefined} legacyWeekdays={state.working?.fixtureSettings?.automaticWeekdays === undefined} onWeekdaysChange={value => { setDraft(current => ({ ...current,automaticWeekdays: value })); setError('') }} onChange={(key, value) => { setDraft(current => ({ ...current, [key]: value })); setError('') }} />
      {field('duration', 'Duración de cada partido (minutos)', 'number')}
      <Text size="xs" c="dimmed">Las excepciones importadas se preservan, sin editor en esta etapa. Con resultados existentes no se permite cambiar ni inferir una duración histórica.</Text>
      {!validation.ok && <Text c="orange.8" size="sm">{validation.error}</Text>}
      {!!impacts.length && <Alert color="orange">{plural(impacts.length, 'registro requiere', 'registros requieren')} revisión con esta configuración. Se conservarán íntegros; revisa el detalle después de guardar. El calendario no queda validado automáticamente.</Alert>}
      {error && <Text role="alert" c="red" size="sm">{error}</Text>}
      <Group justify="space-between"><Text role="status" aria-live="polite" size="sm">{state.saving ? 'Guardando configuración…' : 'Solo se guarda al confirmar.'}</Text><Group><Button disabled={state.saving} variant="default" onClick={close}>Cancelar</Button><Button type="submit" loading={state.saving} disabled={state.saving || !validation.ok}>Guardar configuración</Button></Group></Group>
    </Stack></form>
  </Modal><Modal opened={discard} onClose={() => setDiscard(false)} centered size="sm" zIndex={410} title="¿Descartar cambios?" closeButtonProps={{ 'aria-label': 'Continuar editando configuración' }}><Stack><Text size="sm">La configuración tiene cambios sin guardar.</Text><Group justify="flex-end"><Button variant="default" data-autofocus onClick={() => setDiscard(false)}>Continuar editando</Button><Button color="red" onClick={onClose}>Descartar cambios</Button></Group></Stack></Modal></>
}


export function V2HourWindowsFields({ draft, disabled, legacy, legacyWeekdays, onWeekdaysChange, onChange }: {
  draft: V2ConfigurationDraft; disabled: boolean; legacy: boolean; legacyWeekdays?: boolean; onWeekdaysChange: (value: number[]) => void;
  onChange: (key: 'opensAt' | 'closesAt' | 'tournamentOpensAt' | 'tournamentClosesAt', value: string) => void
}) {
  return <Stack gap="md">
    <Fieldset legend="Disponibilidad de la cancha"><SimpleGrid cols={{ base: 1, sm: 2 }}>
      <HourEntryInput label="Apertura" value={draft.opensAt} disabled={disabled} onChange={value => onChange('opensAt', value)} />
      <HourEntryInput label="Cierre" value={draft.closesAt} allow24 disabled={disabled} onChange={value => onChange('closesAt', value)} />
    </SimpleGrid></Fieldset>
    <Fieldset legend="Horario del torneo"><Stack gap="xs">
      <Text size="sm">La generación automática usará este horario</Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <HourEntryInput label="Desde" value={draft.tournamentOpensAt} disabled={disabled} onChange={value => onChange('tournamentOpensAt', value)} />
        <HourEntryInput label="Hasta" value={draft.tournamentClosesAt} allow24 disabled={disabled} onChange={value => onChange('tournamentClosesAt', value)} />
      </SimpleGrid>
      <V2AutomaticWeekdaysField value={draft.automaticWeekdays} disabled={disabled} onChange={onWeekdaysChange} />
      {legacyWeekdays && <Text size="xs" c="dimmed">Sin días guardados se usan lunes a viernes. Los partidos existentes en fin de semana se conservan; puedes incluir sábado y domingo para nuevas generaciones.</Text>}
      {legacy && <Text size="xs" c="dimmed">Torneo importado sin un horario de generación separado: por compatibilidad se usa la disponibilidad de la cancha. Confirma o ajusta estos horarios al guardar.</Text>}
    </Stack></Fieldset>
  </Stack>
}


const weekdayChoices = [
  { value: 1,short: 'L',label: 'Lunes' },{ value: 2,short: 'M',label: 'Martes' },
  { value: 3,short: 'X',label: 'Miércoles' },{ value: 4,short: 'J',label: 'Jueves' },
  { value: 5,short: 'V',label: 'Viernes' },{ value: 6,short: 'S',label: 'Sábado' },{ value: 7,short: 'D',label: 'Domingo' },
]
export function V2AutomaticWeekdaysField({ value,disabled,onChange }: { value: number[]; disabled: boolean; onChange: (days: number[]) => void }) {
  return <Stack gap={4}><Text fw={500} size="sm">Días del torneo</Text><Group gap={4} role="group" aria-label="Días del torneo">{weekdayChoices.map(day => <Tooltip key={day.value} label={day.label} withArrow><Button type="button" w={44} h={44} px={0} variant={value.includes(day.value) ? 'filled' : 'default'} disabled={disabled} aria-label={day.label} aria-pressed={value.includes(day.value)} onClick={() => onChange(value.includes(day.value) ? value.filter(selected => selected !== day.value) : [...value,day.value].sort((a,b) => a-b))}>{day.short}</Button></Tooltip>)}</Group>
    <Text size="xs" c="dimmed">Se aplican cada semana del período. Sábado y domingo son opcionales.</Text>
    {!value.length && <Text size="xs" c="orange.8" role="alert">Selecciona al menos un día del torneo.</Text>}
  </Stack>
}
