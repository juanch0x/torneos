import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { Link, useSearch } from '@tanstack/react-router'
import { Alert, Button, Group, Paper, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core'
import type { Tournament } from '../../domain/types'
import { plural } from '../../domain/text'
import { getV2SetupDraft, isV2SetupComplete, v2CategoryRemovalImpact, v2SetupIssues, type V2SetupDraft } from '../../domain/v2Setup'
import { applyV2Setup } from '../../domain/v2SetupApply'
import { v2ConfigurationIssues } from '../../domain/v2Configuration'
import { v2SessionController } from '../../router/v2SessionController'
import { v2SessionStore } from '../../store/v2Session'
import { V2HourWindowsFields, hasLegacyPlanningData } from '../read-v2/V2ConfigurationPanel'
import { V2SessionStatus, V2SourceControls } from '../read-v2/V2SourceControls'
import { planningIssueText } from '../read-v2/planningIssueText'
import { CategoriesEditor } from './CategoriesEditor'
import { groupPairCounts, isSetupDraftDirty, setupPageMode } from './configurationPageModel'

export function TournamentConfigurationPage() {
  const { tournamentId } = useSearch({ from: '/v2/configuration' })
  const state = useStore(v2SessionStore)
  if (!tournamentId) return <Stack>
    <Alert color="orange">Seleccioná un torneo para configurar sus categorías y horarios. Esta página requiere un torneo guardado.</Alert>
    <Button component={Link} to="/">Volver a torneos</Button>
  </Stack>

  const working = state.sourceId === tournamentId && state.status === 'loaded' ? state.working : null
  return <Stack gap="lg">
    <V2SourceControls view="configuration" tournamentId={tournamentId} />
    <V2SessionStatus tournamentId={tournamentId} />
    {working && <ConfigurationForm key={`${tournamentId}:${state.draftDiscardRevision}`} tournamentId={tournamentId} working={working} />}
  </Stack>
}

function ConfigurationForm({ tournamentId, working }: { tournamentId: string; working: Tournament }) {
  const state = useStore(v2SessionStore)
  const [snapshot, setSnapshot] = useState(() => ({ initial: getV2SetupDraft(working), epoch: state.epoch }))
  const [draft, setDraft] = useState(snapshot.initial)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const dirty = isSetupDraftDirty(snapshot.initial, draft)
  const locked = setupPageMode(working) === 'locked'
  const disabled = locked || state.saving || state.writeUncertain
  const validation = applyV2Setup(working, draft)
  const impacts = validation.ok ? v2ConfigurationIssues(validation.document) : []
  const issues = v2SetupIssues(working)
  const pairCounts = groupPairCounts(working)
  const saveError = error || (state.saveIssue ? planningIssueText(state.saveIssue) : state.saveError)
  const legacy = hasLegacyPlanningData(working)

  useEffect(() => { v2SessionStore.setState({ draftDirty: dirty }) }, [dirty])
  useEffect(() => () => { v2SessionStore.setState({ draftDirty: false }) }, [])

  function change<K extends keyof V2SetupDraft>(key: K, value: V2SetupDraft[K]) {
    setDraft(current => ({ ...current, [key]: value }))
    setError('')
    setSaved(false)
  }

  function field(key: 'startDate' | 'endDate' | 'duration', label: string, type: 'date' | 'number') {
    return <TextInput label={label} type={type} required disabled={disabled} value={draft[key]}
      onChange={event => change(key, event.currentTarget.value)} {...(key === 'duration' ? { min: 1, step: 1 } : {})} />
  }

  return <Paper withBorder p="lg" radius="md">
    <form onSubmit={async event => {
      event.preventDefault()
      const current = v2SessionStore.getState()
      if (locked || current.saving || current.writeUncertain || !dirty) return
      setError('')
      setSaved(false)
      const result = await v2SessionController.saveSetup(draft, { sourceId: tournamentId, epoch: snapshot.epoch })
      if (!result.ok) { setError(result.issue ? planningIssueText(result.issue) : result.error); return }
      const confirmed = v2SessionStore.getState()
      if (confirmed.sourceId !== tournamentId || !confirmed.working) return
      const initial = getV2SetupDraft(confirmed.working)
      setSnapshot({ initial, epoch: confirmed.epoch })
      setDraft(initial)
      setSaved(true)
    }}><Stack gap="lg">
      <Title order={1}>Configuración del torneo</Title>
      {locked ? <Alert color="blue" title="Configuración de solo lectura">
        Después de la primera generación del calendario, la configuración queda en solo lectura. Solo podés editar las restricciones de las parejas y regenerar el calendario.
        <Group mt="sm">
          <Button variant="light" renderRoot={props => <Link {...props} to="/v2/groups" search={{ tournamentId }} />}>Ver grupos</Button>
          <Button variant="light" renderRoot={props => <Link {...props} to="/v2/calendar" search={{ tournamentId }} />}>Ver calendario</Button>
        </Group>
      </Alert> : <Text size="sm">Definí las categorías, el período y los horarios antes de cargar las parejas. Guardar no genera ni reprograma partidos.</Text>}

      <Stack gap="sm">
        <Title order={2} size="h3">Categorías</Title>
        <CategoriesEditor value={draft.categories} disabled={disabled} onChange={value => change('categories', value)}
          impact={categoryId => v2CategoryRemovalImpact(working, categoryId)} groupPairCount={groupId => pairCounts.get(groupId) ?? 0} />
      </Stack>
      <Stack gap="sm">
        <Title order={2} size="h3">Período del torneo</Title>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>{field('startDate', 'Primer día del período', 'date')}{field('endDate', 'Último día del período', 'date')}</SimpleGrid>
      </Stack>
      <Stack gap="sm">
        <Text size="sm">La disponibilidad de la cancha indica su apertura física; el horario del torneo define la ventana para la generación automática.</Text>
        {/* The shared hour fields already include V2AutomaticWeekdaysField. */}
        <V2HourWindowsFields draft={draft} disabled={disabled}
          legacy={legacy && working.fixtureSettings?.automaticWindow === undefined}
          legacyWeekdays={legacy && working.fixtureSettings?.automaticWeekdays === undefined}
          onWeekdaysChange={value => change('automaticWeekdays', value)} onChange={change} />
      </Stack>
      <Stack gap="sm">
        <Title order={2} size="h3">Duración de cada partido</Title>
        {field('duration', 'Duración de cada partido (minutos)', 'number')}
      </Stack>
      <Text size="xs" c="dimmed">Las excepciones de cancha existentes se preservan, sin editor en esta etapa. Con resultados existentes no se permite cambiar ni inferir una duración histórica.</Text>
      {!locked && !validation.ok && <Text c="orange.8" size="sm">{validation.error}</Text>}
      {!!impacts.length && <Alert color="orange">{plural(impacts.length, 'registro requiere', 'registros requieren')} revisión con esta configuración. Se conservarán íntegros; revisá el detalle después de guardar. El calendario no queda validado automáticamente.</Alert>}
      {!!issues.length && <Stack gap="xs">
        <Title order={2} size="h3">Falta completar</Title>
        <ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>
      </Stack>}
      {saveError && <Text role="alert" c="red" size="sm">{saveError}</Text>}
      {saved && <Text role="status" aria-live="polite" c="green.8">Configuración guardada.</Text>}
      {!locked && <Text size="sm" c="dimmed">Al generar el calendario por primera vez, la configuración, las categorías, los grupos y las parejas quedan bloqueados.</Text>}
      <Group justify="flex-end">
        {!locked && <Button type="submit" loading={state.saving} disabled={disabled || !dirty}>Guardar configuración</Button>}
        {!dirty && isV2SetupComplete(working) && <Button disabled={state.saving || state.writeUncertain} renderRoot={props => <Link {...props} to="/tournaments/$id/groups" params={{ id: tournamentId }} />}>Continuar a parejas</Button>}
      </Group>
    </Stack></form>
  </Paper>
}
