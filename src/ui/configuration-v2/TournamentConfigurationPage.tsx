import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { useForm, useStore as useFormStore } from '@tanstack/react-form'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { Alert, Button, Group, List, Paper, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core'
import type { Tournament } from '../../domain/types'
import { plural } from '../../domain/text'
import { getV2SetupDraft, isV2SetupComplete, v2CategoryRemovalImpact, type V2SetupDraft } from '../../domain/v2Setup'
import { v2ConfigurationDraftIssues, v2SetupDraftIssues, type V2DraftIssue } from '../../domain/v2SetupSchema'
import { applyV2Setup } from '../../domain/v2SetupApply'
import { applyV2Configuration, v2ConfigurationIssues } from '../../domain/v2Configuration'
import { v2SessionController } from '../../router/v2SessionController'
import { v2SessionStore } from '../../store/v2Session'
import { V2HourWindowsFields, hasLegacyPlanningData } from '../read-v2/V2ConfigurationPanel'
import { V2SessionStatus } from '../read-v2/V2SourceControls'
import { V2NavigationGuard } from '../read-v2/V2NavigationGuard'
import { planningIssueText } from '../read-v2/planningIssueText'
import { CategoriesEditor } from './CategoriesEditor'
import { TournamentBreadcrumb } from '../TournamentBreadcrumb'
import { groupPairCounts, isConfigurationDraftDirty, isSetupDraftDirty, setupPageMode } from './configurationPageModel'

export function TournamentConfigurationPage() {
  const { tournamentId } = useSearch({ from: '/v2/configuration' })
  const state = useStore(v2SessionStore)
  if (!tournamentId) return <Stack>
    <Alert color="orange">Seleccioná un torneo para configurar sus categorías y horarios. Esta página requiere un torneo guardado.</Alert>
    <Button component={Link} to="/">Volver a torneos</Button>
  </Stack>

  const working = state.sourceId === tournamentId && state.status === 'loaded' ? state.working : null
  return <Stack gap="lg">
    {working && <Stack gap="sm"><TournamentBreadcrumb tournamentId={tournamentId} name={working.name} current="Configuración" linkTournament={isV2SetupComplete(working)} />
      <Title order={1} size="h2" style={{ overflowWrap: 'anywhere' }}>Configuración: {working.name}</Title></Stack>}
    <V2NavigationGuard tournamentId={tournamentId} />
    <V2SessionStatus tournamentId={tournamentId} />
    {working && <ConfigurationForm key={`${tournamentId}:${state.draftDiscardRevision}`} tournamentId={tournamentId} working={working} />}
  </Stack>
}

/** Draft paths that have their own input (and therefore show their error inline). */
function hasFieldInput(path: string): boolean {
  return !path.includes('.') || /^categories\.\d+\.(name|groups)$/.test(path)
}

type BaselineKey = 'startDate' | 'endDate' | 'opensAt' | 'closesAt' | 'tournamentOpensAt' | 'tournamentClosesAt' | 'automaticWeekdays' | 'duration'

function ConfigurationForm({ tournamentId, working }: { tournamentId: string; working: Tournament }) {
  const state = useStore(v2SessionStore)
  const [snapshot, setSnapshot] = useState(() => ({ initial: getV2SetupDraft(working), epoch: state.epoch }))
  const [error, setError] = useState('')
  const navigate = useNavigate()
  // Paths the user has left at least once; their errors show before the first save attempt.
  const [blurred, setBlurred] = useState<ReadonlySet<string>>(new Set())
  // After the first save attempt every error is visible.
  const [submitted, setSubmitted] = useState(false)
  const mode = setupPageMode(working)
  const locked = mode === 'locked'
  const baselineOnly = mode === 'baseline-only'

  const form = useForm({
    defaultValues: snapshot.initial,
    onSubmit: async ({ value }) => {
      const current = v2SessionStore.getState()
      if (locked || current.saving || current.writeUncertain) return
      const { categories: _categories, ...baseline } = value
      const expected = { sourceId: tournamentId, epoch: snapshot.epoch }
      const result = baselineOnly
        ? await v2SessionController.saveConfiguration(baseline, expected)
        : await v2SessionController.saveSetup(value, expected)
      if (!result.ok) {
        // Session failures already land in the store and render in V2NavigationGuard.
        const session = v2SessionStore.getState()
        if (!session.saveError && !session.saveIssue) setError(result.issue ? planningIssueText(result.issue) : result.error)
        return
      }
      const confirmed = v2SessionStore.getState()
      if (confirmed.sourceId !== tournamentId || !confirmed.working) return
      const initial = getV2SetupDraft(confirmed.working)
      setSnapshot({ initial, epoch: confirmed.epoch })
      form.reset(initial)
      continueToTournament()
    },
  })
  const draft = useFormStore(form.store, formState => formState.values)

  const { categories, ...baselineDraft } = draft
  const dirty = baselineOnly ? isConfigurationDraftDirty(snapshot.initial, baselineDraft) : isSetupDraftDirty(snapshot.initial, draft)
  const disabled = locked || state.saving || state.writeUncertain
  const issues: V2DraftIssue[] = locked ? [] : baselineOnly ? v2ConfigurationDraftIssues(baselineDraft) : v2SetupDraftIssues(draft)
  const validation = issues.length ? null : baselineOnly ? applyV2Configuration(working, baselineDraft) : applyV2Setup(working, draft)
  const impacts = validation?.ok ? v2ConfigurationIssues(validation.document) : []
  // State-dependent rules are not field errors.
  const stateError = validation && !validation.ok && !locked ? validation.error : ''
  const pairCounts = groupPairCounts(working)
  const legacy = hasLegacyPlanningData(working)
  const visibleErrors = submitted ? issues : issues.filter(issue => blurred.has(issue.path))
  const errorFor = (path: string) => visibleErrors.find(issue => issue.path === path)?.message
  // Issues without a rendered input (e.g. a blank legacy group name) go to the alert instead.
  const orphanErrors = submitted ? issues.filter(issue => !hasFieldInput(issue.path)).map(issue => issue.message) : []
  // Field errors render under their inputs; the alert only carries errors no input can own.
  // Session save errors are rendered by V2NavigationGuard.
  const alertMessages = [...new Set([...orphanErrors, ...(submitted && stateError ? [stateError] : []), ...(error ? [error] : [])])]

  useEffect(() => { v2SessionStore.setState({ draftDirty: dirty }) }, [dirty])
  useEffect(() => () => { v2SessionStore.setState({ draftDirty: false }) }, [])

  function change<K extends keyof V2SetupDraft>(key: K, value: V2SetupDraft[K]) {
    form.setFieldValue(key, value as never)
    setError('')
  }
  /** Saving is the way forward: pair capture, or the calendar when pairs are already locked. */
  function continueToTournament() {
    // Clear the draft flag now so the navigation guard does not block this exit.
    v2SessionStore.setState({ draftDirty: false })
    if (baselineOnly) void navigate({ to: '/v2/calendar', search: { tournamentId } })
    else void navigate({ to: '/v2/groups', search: { tournamentId } })
  }
  function blur(path: string) {
    setBlurred(current => current.has(path) ? current : new Set(current).add(path))
  }

  function field(key: Extract<BaselineKey, 'startDate' | 'endDate' | 'duration'>, label: string, type: 'date' | 'number') {
    return <TextInput label={label} type={type} withAsterisk disabled={disabled} value={draft[key]} error={errorFor(key)}
      onBlur={() => blur(key)} onChange={event => change(key, event.currentTarget.value)} {...(key === 'duration' ? { min: 1, step: 1 } : {})} />
  }

  return <Paper withBorder p="lg" radius="md">
    <form noValidate onSubmit={event => {
      event.preventDefault()
      setError('')
      const current = v2SessionStore.getState()
      if (locked || current.saving || current.writeUncertain) return
      // Always enabled: the first attempt reveals every error, even on an untouched draft.
      setSubmitted(true)
      if (issues.length || stateError) return
      // A clean, complete setup has nothing to write: just move on.
      if (!baselineOnly && !dirty && isV2SetupComplete(working)) { continueToTournament(); return }
      void form.handleSubmit()
    }}><Stack gap="lg">
      {locked ? <Alert color="blue" title="Configuración de solo lectura">
        Después de la primera generación del calendario, la configuración queda en solo lectura. Solo podés editar las restricciones de las parejas y regenerar el calendario.
        <Group mt="sm">
          <Button variant="light" renderRoot={props => <Link {...props} to="/v2/groups" search={{ tournamentId }} />}>Ver grupos</Button>
          <Button variant="light" renderRoot={props => <Link {...props} to="/v2/calendar" search={{ tournamentId }} />}>Ver calendario</Button>
        </Group>
      </Alert> : baselineOnly ? <Alert color="orange" title="Completá la configuración de horarios">
        El torneo ya tiene un calendario generado. Las categorías, los grupos y las parejas quedan bloqueados, pero tenés que completar la configuración de horarios que falta para abrir el calendario y editar las restricciones.
      </Alert> : <Text size="sm">Definí las categorías, el período y los horarios antes de cargar las parejas. Guardar no genera ni reprograma partidos.</Text>}
      {!!alertMessages.length && <Alert color="red" role="alert" title="No se puede guardar la configuración">
        {alertMessages.length === 1 ? alertMessages[0] : <List size="sm">{alertMessages.map(message => <List.Item key={message}>{message}</List.Item>)}</List>}
      </Alert>}

      <CategoriesEditor value={categories} disabled={disabled || baselineOnly} onChange={value => change('categories', value)}
        errors={errorFor} onBlurField={blur}
        impact={categoryId => v2CategoryRemovalImpact(working, categoryId)} groupPairCount={groupId => pairCounts.get(groupId) ?? 0} />
      <Stack gap="sm">
        <Title order={2} size="h3">Período del torneo</Title>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>{field('startDate', 'Primer día del período', 'date')}{field('endDate', 'Último día del período', 'date')}</SimpleGrid>
      </Stack>
      <Stack gap="sm">
        <Text size="sm">La disponibilidad de la cancha indica su apertura física; el horario del torneo define la ventana para la generación automática.</Text>
        {/* The shared hour fields already include V2AutomaticWeekdaysField. */}
        <V2HourWindowsFields draft={draft} disabled={disabled} errors={errorFor} onBlur={blur}
          legacy={legacy && working.fixtureSettings?.automaticWindow === undefined}
          legacyWeekdays={legacy && working.fixtureSettings?.automaticWeekdays === undefined}
          onWeekdaysChange={value => { change('automaticWeekdays', value); blur('automaticWeekdays') }} onChange={change} />
      </Stack>
      <Stack gap="sm">
        <Title order={2} size="h3">Duración de cada partido</Title>
        {field('duration', 'Duración de cada partido (minutos)', 'number')}
      </Stack>
      <Text size="xs" c="dimmed">Las excepciones de cancha existentes se preservan, sin editor en esta etapa.</Text>
      {!!impacts.length && <Alert color="orange">{plural(impacts.length, 'registro requiere', 'registros requieren')} revisión con esta configuración. Se conservarán íntegros; revisá el detalle después de guardar. El calendario no queda validado automáticamente.</Alert>}
      {mode === 'edit' && <Text size="sm" c="dimmed">Al generar el calendario por primera vez, la configuración, las categorías, los grupos y las parejas quedan bloqueados.</Text>}
      <Group justify="flex-end">
        {!locked && <Button type="submit" loading={state.saving} disabled={disabled}>Guardar y continuar</Button>}
      </Group>
    </Stack></form>
  </Paper>
}
