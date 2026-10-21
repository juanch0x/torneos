import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMemo, useState, useRef } from 'react'
import { Alert, Button, Group, Paper, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import type { TournamentMeta } from '../domain/types'
import { useTournamentStore } from '../store/tournamentStore'
import { formatTournamentPeriod } from './tournamentPeriod'
import { ErrorIcon } from './icons'
import { tournamentNameError } from './tournamentName'

const columnHelper = createColumnHelper<TournamentMeta>()

export function TournamentList() {
  const list = useTournamentStore((s) => s.list)
  const listError = useTournamentStore(s => s.listError)
  const loadList = useTournamentStore(s => s.loadList)
  const [creationError, setCreationError] = useState('')
  const [creating, setCreating] = useState(false)
  const creatingRef = useRef(false)
  const newTournament = useTournamentStore((s) => s.newTournament)
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', { header: 'Nombre' }),
      columnHelper.display({ id: 'period', header: 'Fecha', cell: ({ row }) => formatTournamentPeriod(row.original.periodStart, row.original.periodEnd) }),
      columnHelper.accessor('categoryCount', { header: 'Categorías' }),
      columnHelper.display({
        id: 'acciones',
        header: '',
        cell: ({ row }) => (
          <Group justify="flex-end">
            <Button
              size="xs"
              variant="light"
              renderRoot={props => <Link {...props} to="/v2/groups" search={{ tournamentId: row.original.id }} />}
            >
              Abrir
            </Button>
          </Group>
        ),
      }),
    ],
    [],
  )

  const table = useReactTable({ data: list, columns, getCoreRowModel: getCoreRowModel() })

  const create = () => {
    if (creatingRef.current) return
    const error = tournamentNameError(name)
    setNameError(error)
    if (error) return
    creatingRef.current = true; setCreating(true); setCreationError('')
    const trimmed = name.trim()
    void newTournament(trimmed).then(() => {
      setName('')
      const id = useTournamentStore.getState().current!.id
      return navigate({ to: '/v2/configuration', search: { tournamentId: id } })
    }).catch(() => setCreationError('No se pudo confirmar la creación. Releé la lista antes de reintentar: el documento puede haberse guardado parcialmente.')).finally(() => { creatingRef.current = false; setCreating(false) })
  }

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={1} size="h2">Torneos</Title>
        <Text c="dimmed" size="sm">Creá un torneo o abrí uno existente.</Text>
      </Stack>
      {listError && (
        <Alert icon={<ErrorIcon />} color="red" title="No se pudo leer la lista">
          {listError}
          <Button mt="sm" size="xs" variant="light" onClick={() => void loadList()}>Reintentar lectura</Button>
        </Alert>
      )}
      {creationError && <Alert icon={<ErrorIcon />} color="red">{creationError}</Alert>}

      <Paper withBorder p="md">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            create()
          }}
        >
          <Group gap="sm" align="flex-end" wrap="wrap">
            <TextInput
              label="Nombre del torneo"
              value={name}
              error={nameError}
              onChange={(e) => {
                setName(e.target.value)
                if (nameError) setNameError(null)
              }}
              style={{ flex: 1 }}
            />
            <Button type="submit" disabled={creating} loading={creating}>
              Nuevo torneo
            </Button>
          </Group>
        </form>
      </Paper>

      {list.length === 0 ? (
        <Paper withBorder p="md">
          <Stack gap={4}>
            <Text className="tn-label" fz="xs">Sin torneos</Text>
            <Text c="dimmed" size="sm">Todavía no hay torneos. Creá el primero con el formulario de arriba.</Text>
          </Stack>
        </Paper>
      ) : (
        <Table.ScrollContainer minWidth={480}>
          <Table>
            <Table.Thead>
              {table.getHeaderGroups().map((hg) => (
                <Table.Tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <Table.Th key={header.id}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </Table.Th>
                  ))}
                </Table.Tr>
              ))}
            </Table.Thead>
            <Table.Tbody>
              {table.getRowModel().rows.map((row) => (
                <Table.Tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <Table.Td key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Stack>
  )
}
