import { useState } from 'react'
import { Link, useSearch } from '@tanstack/react-router'
import { V2SourceControls } from '../read-v2/V2SourceControls'
import { RealV2Groups } from '../read-v2/RealPlanningViews'
import { Badge, Button, Group, Menu, Modal, NativeSelect, Paper, SimpleGrid, Stack, Tabs, Text, TextInput, Title } from '@mantine/core'
import { RestrictionModal } from './RestrictionModal'
import { type RestrictionWindow } from './restrictionWindows'
import './preparationMock.css'
import { plural } from '../../domain/text'

interface DemoPair { id: string; categoryId: string; groupId: string | null; first: string; second: string; windows: RestrictionWindow[] }
const categories = [
  { id: 'first', name: 'Primera', color: 'grape' }, { id: 'second', name: 'Segunda', color: 'teal' },
  { id: 'third', name: 'Tercera', color: 'orange' }, { id: 'fourth', name: 'Cuarta', color: 'blue' },
]
const names = [
  ['Pérez', 'Gil', 'López', 'Ruiz', 'Mora', 'Soler', 'Cano', 'Valle', 'Vega', 'Lara'],
  ['Díaz', 'Paz', 'Soto', 'Vera', 'Castro', 'Peña', 'Torres', 'Alba', 'Ramos', 'Ibarra'],
  ['Ríos', 'Luna', 'Vidal', 'Costa', 'Nieto', 'Cruz', 'Serra', 'Navas', 'Ponce', 'Bravo'],
  ['León', 'Arias', 'Silva', 'Rey', 'Sosa', 'Acosta', 'Franco', 'Duarte', 'Roca', 'Vila'],
]
const initialGroups = categories.flatMap((category) => ['A', 'B'].map((name) => ({ id: `${category.id}-${name}`, categoryId: category.id, name: `Grupo ${name}` })))
const initialPairs: DemoPair[] = categories.flatMap((category, index) => Array.from({ length: 5 }, (_, pair) => ({
  id: `${category.id}-${pair}`, categoryId: category.id, groupId: pair === 4 ? null : `${category.id}-${pair < 2 ? 'A' : 'B'}`,
  first: names[index][pair * 2], second: names[index][pair * 2 + 1],
  windows: pair === 0 ? [{ id: `${category.id}-sample`, start: '2026-10-06T19:00', end: '2026-10-06T20:30', reason: 'Inglés' }] : [],
})))

export function GroupsMockPage() {
  const { tournamentId } = useSearch({ from: '/v2/groups' })
  return <Stack><V2SourceControls view="groups" tournamentId={tournamentId} />{tournamentId ? <RealV2Groups key={tournamentId} tournamentId={tournamentId} /> : <DemoGroupsPage />}</Stack>
}
function DemoGroupsPage() {
  const [pairs, setPairs] = useState(initialPairs)
  const [groups, setGroups] = useState(initialGroups)
  const [categoryId, setCategoryId] = useState('first')
  const [action, setAction] = useState<{ id: string; type: 'edit' | 'assign' | 'restrictions' } | null>(null)
  const [first, setFirst] = useState('')
  const [second, setSecond] = useState('')
  const [groupId, setGroupId] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [notice, setNotice] = useState('Ejemplo independiente: los cambios aquí no modifican el calendario V2.')
  const selected = pairs.find((pair) => pair.id === action?.id)

  function open(pair: DemoPair, type: NonNullable<typeof action>['type']) {
    setFirst(pair.first); setSecond(pair.second); setGroupId(pair.groupId ?? ''); setAction({ id: pair.id, type })
  }
  function updatePair(changes: Partial<DemoPair>) {
    setPairs((current) => current.map((pair) => pair.id === selected?.id ? { ...pair, ...changes } : pair)); setAction(null)
  }

  return <Stack gap="lg" className="preparation-v2">
    <Group justify="space-between" align="flex-start"><Stack gap={6}>
      <Group><Badge color="grape" variant="light">V2 · Prototipo</Badge><Text size="sm" c="dimmed">Datos ficticios · Sin guardar</Text></Group>
      <Title order={1} size="h2">Preparar grupos y restricciones</Title>
      <Text c="dimmed">Categorías definidas. Grupos claros. Marcá únicamente las excepciones.</Text>
    </Stack><Group><Button component={Link} to="/v2/calendar" variant="light">Probar calendario</Button><Button component={Link} to="/v2/read" variant="subtle">Leer torneo real</Button><Button component={Link} to="/" variant="subtle">Volver a torneos</Button></Group></Group>
    <Paper withBorder p="sm" radius="md"><Text size="sm">Este ejemplo no comparte datos con el calendario. Guardar restricciones NUNCA reprograma partidos.</Text></Paper>
    <Tabs value={categoryId} onChange={(value) => { if (value) setCategoryId(value) }}>
      <Tabs.List>{categories.map((category) => <Tabs.Tab key={category.id} value={category.id}>{category.name} <Badge ml={6} size="sm" color={category.color} variant="light">{pairs.filter((pair) => pair.categoryId === category.id).length}</Badge></Tabs.Tab>)}</Tabs.List>
      {categories.map((category) => <Tabs.Panel key={category.id} value={category.id} pt="lg">
        <Stack gap="md"><Group justify="space-between"><Title order={2} size="h4">{category.name}</Title><Button variant="default" onClick={() => { setGroupName(''); setAddOpen(true) }}>Agregar grupo</Button></Group>
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            {[...groups.filter((group) => group.categoryId === category.id), { id: null, name: 'Sin grupo' }].map((group) => {
              const members = pairs.filter((pair) => pair.categoryId === category.id && pair.groupId === group.id)
              return <Paper key={group.id ?? 'unassigned'} withBorder p="md" radius="lg"><Stack gap="md">
                <Group justify="space-between"><Title order={3} size="h5">{group.name}</Title><Text size="sm" c="dimmed">{plural(members.length, 'pareja', 'parejas')}</Text></Group>
                {members.length === 0 && <Text size="sm" c="dimmed">Sin parejas asignadas.</Text>}
                {members.map((pair) => <Paper key={pair.id} withBorder p="sm" radius="md">
                  <Group justify="space-between" wrap="nowrap" align="flex-start"><Stack gap={3}>
                    <Text fw={600} size="sm">{pair.first} / {pair.second}</Text>
                    <Button size="compact-xs" variant="subtle" color={pair.windows.length ? 'red' : 'teal'} onClick={() => open(pair, 'restrictions')}>
                      {pair.windows.length ? `${pair.windows.length} ${pair.windows.length === 1 ? 'restricción' : 'restricciones'}` : 'Sin restricciones'}
                    </Button>
                  </Stack><Menu withinPortal width={210} position="bottom-end"><Menu.Target><Button variant="subtle" size="compact-sm" aria-label={`Acciones de ${pair.first} y ${pair.second}`}>⋯</Button></Menu.Target><Menu.Dropdown>
                    <Menu.Item onClick={() => open(pair, 'edit')}>Editar nombres</Menu.Item>
                    <Menu.Item onClick={() => open(pair, 'assign')}>Asignar / cambiar grupo</Menu.Item>
                    <Menu.Item onClick={() => open(pair, 'restrictions')}>Restricciones</Menu.Item>
                  </Menu.Dropdown></Menu></Group>
                </Paper>)}
              </Stack></Paper>
            })}
          </SimpleGrid>
        </Stack>
      </Tabs.Panel>)}
    </Tabs>
    <Text role="status" aria-live="polite" size="sm">{notice}</Text>
    <Modal opened={!!selected && action?.type !== 'restrictions'} onClose={() => setAction(null)} title={action?.type === 'edit' ? 'Editar pareja' : 'Asignar grupo'} centered>
      {selected && <Stack>
        {action?.type === 'edit' ? <><TextInput label="Integrante 1" value={first} onChange={(event) => setFirst(event.currentTarget.value)} /><TextInput label="Integrante 2" value={second} onChange={(event) => setSecond(event.currentTarget.value)} /></> : <>
          <Text fw={600}>{selected.first} / {selected.second}</Text><NativeSelect label="Grupo" value={groupId} onChange={(event) => setGroupId(event.currentTarget.value)} data={[{ value: '', label: 'Sin grupo' }, ...groups.filter((group) => group.categoryId === selected.categoryId).map((group) => ({ value: group.id, label: group.name }))]} />
        </>}
        <Group justify="flex-end"><Button variant="default" onClick={() => setAction(null)}>Cancelar</Button><Button disabled={action?.type === 'edit' && (!first.trim() || !second.trim())} onClick={() => { updatePair(action?.type === 'edit' ? { first: first.trim(), second: second.trim() } : { groupId: groupId || null }); setNotice('Pareja actualizada solo en este ejemplo.') }}>Aplicar al ejemplo</Button></Group>
      </Stack>}
    </Modal>
    <Modal opened={addOpen} onClose={() => setAddOpen(false)} title="Agregar grupo" centered><Stack>
      <TextInput label="Nombre del grupo" value={groupName} onChange={(event) => setGroupName(event.currentTarget.value)} />
      <Button disabled={!groupName.trim() || groups.some((group) => group.categoryId === categoryId && group.name.toLowerCase() === groupName.trim().toLowerCase())} onClick={() => {
        setGroups((current) => [...current, { id: crypto.randomUUID(), categoryId, name: groupName.trim() }]); setAddOpen(false); setNotice('Grupo agregado al ejemplo.')
      }}>Agregar grupo</Button>
    </Stack></Modal>
    {selected && action?.type === 'restrictions' && <RestrictionModal key={selected.id} pairName={`${selected.first} / ${selected.second}`} initialWindows={selected.windows}
      onCancel={() => setAction(null)} onSave={(windows) => { updatePair({ windows }); setNotice(`Restricciones de ${selected.first} / ${selected.second} guardadas solo en este ejemplo. Ningún partido fue reprogramado.`) }} />}
  </Stack>
}
