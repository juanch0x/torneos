import { HourEntryInput } from './HourEntryInput'
import { useEffect } from 'react'
import { useStore } from 'zustand'
import { Link } from '@tanstack/react-router'
import { ActionIcon, Badge, Chip, Fieldset, Group, Input, SimpleGrid, Stack, Text, Title, Tooltip } from '@mantine/core'
import { hasCompleteV2Configuration, v2ConfigurationIssues, type V2ConfigurationDraft } from '../../domain/v2Configuration'
import { v2SessionStore } from '../../store/v2Session'
import { plural } from '../../domain/text'
import { configurationIssueText } from './organizerWarnings'
import type { Tournament } from '../../domain/types'
import { isV2SetupLocked } from '../../domain/v2Setup'

export function hasLegacyPlanningData(source: Tournament): boolean {
  return source.slots.length > 0 || !!source.pairUnavailableWindows?.length || !!source.calendar?.overrides.length || source.categories.some(category => category.matches.some(match => match.scheduledAt !== undefined || match.result !== undefined))
}

export function V2ConfigurationHeader({ tournamentId }: { tournamentId: string }) {
  const state = useStore(v2SessionStore)
  useEffect(() => {}, [tournamentId, state.draftDiscardRevision])
  const source = state.sourceId === tournamentId && state.status === 'loaded' ? state.working : null
  const ready = hasCompleteV2Configuration(source)
  const issues = source ? v2ConfigurationIssues(source) : []
  const selected = state.sources.find(item => item.id === tournamentId)
  const title = source?.name ?? selected?.name ?? (state.status === 'loading' ? 'Cargando torneo…' : state.status === 'not-found' ? 'Torneo no disponible' : 'Torneo seleccionado')
  const locked = source ? isV2SetupLocked(source) : false
  const gearDisabled = !source || state.saving || state.draftDirty || state.writeUncertain || state.navigationBlocked
  return <Stack gap="xs">
    <Group justify="space-between" wrap="nowrap">
      <Group gap="sm" style={{ flex: 1, minWidth: 0 }}>
        <Title order={1} size="h2" style={{ overflowWrap: 'anywhere' }}>{title}</Title>
        {source && !ready && <Badge color="orange" variant="light">Necesita configuración</Badge>}
        {locked && <Badge color="gray" variant="light">Configuración bloqueada</Badge>}
      </Group>
      <Tooltip label="Configuración del torneo" withArrow>
        <ActionIcon
          size={44}
          style={{ flexShrink: 0 }}
          variant="subtle"
          disabled={gearDisabled}
          // Router navigation: a plain href reloads the whole app (visible blink) and bypasses the navigation guard.
          {...(gearDisabled ? {} : { renderRoot: (props: Record<string, unknown>) => <Link {...props} to="/v2/configuration" search={{ tournamentId }} /> })}
          aria-label="Configurar torneo"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 2h4l.7 3 2.1 1.2 2.9-.9 2 3.4-2.2 2.1v2.4l2.2 2.1-2 3.4-2.9-.9-2.1 1.2-.7 3h-4l-.7-3-2.1-1.2-2.9.9-2-3.4 2.2-2.1v-2.4l-2.2-2.1 2-3.4 2.9.9L9.3 5Z" /><circle cx="12" cy="12" r="3" /></svg>
        </ActionIcon>
      </Tooltip>
    </Group>
    {source && !ready && <Text size="sm" c="orange.8">Completá y guardá la configuración del torneo desde la página de configuración para editar restricciones o abrir el calendario.</Text>}
    {(state.saving || !source) && <Text role="status" aria-live="polite" size="sm">{state.saving ? 'Guardando…' : (state.status === 'loading' ? 'Leyendo el torneo seleccionado…' : state.status === 'not-found' ? 'No se encontró esta fuente.' : state.status === 'error' ? 'No se pudo cargar esta fuente.' : 'Seleccioná o cargá este torneo para configurarlo.')}</Text>}
    {!!issues.length && <details><summary>{plural(issues.length, 'registro requiere', 'registros requieren')} revisión · Horarios intactos</summary><Stack mt="xs" gap={4} style={{ maxHeight: 180, overflowY: 'auto' }}>{issues.map((issue, index) => <Text size="xs" key={index} c="orange.8">{configurationIssueText(source!, issue)}</Text>)}</Stack></details>}
  </Stack>
}


type V2HourKey = 'opensAt' | 'closesAt' | 'tournamentOpensAt' | 'tournamentClosesAt'
export function V2HourWindowsFields({ draft, disabled, legacy, legacyWeekdays, onWeekdaysChange, onChange, errors, onBlur }: {
  draft: V2ConfigurationDraft; disabled: boolean; legacy: boolean; legacyWeekdays?: boolean; onWeekdaysChange: (value: number[]) => void;
  onChange: (key: V2HourKey, value: string) => void
  errors?: (key: V2HourKey | 'automaticWeekdays') => string | undefined; onBlur?: (key: V2HourKey) => void
}) {
  return <Stack gap="md">
    <Fieldset legend="Disponibilidad de la cancha"><SimpleGrid cols={{ base: 1, sm: 2 }}>
      <HourEntryInput label="Apertura" value={draft.opensAt} disabled={disabled} error={errors?.('opensAt')} onBlur={() => onBlur?.('opensAt')} onChange={value => onChange('opensAt', value)} />
      <HourEntryInput label="Cierre" value={draft.closesAt} allow24 disabled={disabled} error={errors?.('closesAt')} onBlur={() => onBlur?.('closesAt')} onChange={value => onChange('closesAt', value)} />
    </SimpleGrid></Fieldset>
    <Fieldset legend="Horario del torneo"><Stack gap="xs">
      <Text size="sm">La generación automática usará este horario</Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <HourEntryInput label="Desde" value={draft.tournamentOpensAt} disabled={disabled} error={errors?.('tournamentOpensAt')} onBlur={() => onBlur?.('tournamentOpensAt')} onChange={value => onChange('tournamentOpensAt', value)} />
        <HourEntryInput label="Hasta" value={draft.tournamentClosesAt} allow24 disabled={disabled} error={errors?.('tournamentClosesAt')} onBlur={() => onBlur?.('tournamentClosesAt')} onChange={value => onChange('tournamentClosesAt', value)} />
      </SimpleGrid>
      <V2AutomaticWeekdaysField value={draft.automaticWeekdays} disabled={disabled} error={errors?.('automaticWeekdays')} onChange={onWeekdaysChange} />
      {legacyWeekdays && <Text size="xs" c="dimmed">Sin días guardados se usan lunes a viernes. Los partidos existentes en fin de semana se conservan; podés incluir sábado y domingo para nuevas generaciones.</Text>}
      {legacy && <Text size="xs" c="dimmed">Torneo importado sin un horario de generación separado: por compatibilidad se usa la disponibilidad de la cancha. Confirmá o ajustá estos horarios al guardar.</Text>}
    </Stack></Fieldset>
  </Stack>
}


const weekdayChoices = [
  { value: 1,short: 'Lun',label: 'Lunes' },{ value: 2,short: 'Mar',label: 'Martes' },
  { value: 3,short: 'Mié',label: 'Miércoles' },{ value: 4,short: 'Jue',label: 'Jueves' },
  { value: 5,short: 'Vie',label: 'Viernes' },{ value: 6,short: 'Sáb',label: 'Sábado' },{ value: 7,short: 'Dom',label: 'Domingo' },
]
export function V2AutomaticWeekdaysField({ value,disabled,onChange,error }: { value: number[]; disabled: boolean; onChange: (days: number[]) => void; error?: string }) {
  // Input.Wrapper keeps label, description and error aligned with the other inputs.
  // size="md" matches the theme default of the other inputs (Input.Wrapper is not themed).
  return <Input.Wrapper label="Días del torneo" withAsterisk mt="sm" size="md"
    error={error ?? (value.length ? undefined : 'Seleccioná al menos un día.')}>
    <Chip.Group multiple value={value.map(String)} onChange={days => onChange(days.map(Number).sort((a,b) => a-b))}>
      <Group gap="xs" mt={6} mb={4} role="group" aria-label="Días del torneo">
        {weekdayChoices.map(day => <Chip key={day.value} value={String(day.value)} disabled={disabled} aria-label={day.label}>{day.short}</Chip>)}
      </Group>
    </Chip.Group>
  </Input.Wrapper>
}
