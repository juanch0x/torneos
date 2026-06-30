import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Button, Group, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import type { TournamentMeta } from '../domain/types'
import { useTournamentStore } from '../store/tournamentStore'
import { formatDate } from './format'

// Today's date as ISO "YYYY-MM-DD" for the default date input value.
function today(): string {
  return new Date().toISOString().slice(0, 10)
}

const columnHelper = createColumnHelper<TournamentMeta>()

export function TournamentList() {
  const list = useTournamentStore((s) => s.list)
  const newTournament = useTournamentStore((s) => s.newTournament)
  const newMockTournament = useTournamentStore((s) => s.newMockTournament)
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [date, setDate] = useState(today())

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', { header: 'Nombre' }),
      columnHelper.accessor('date', { header: 'Fecha', cell: (ctx) => formatDate(ctx.getValue()) }),
      columnHelper.accessor('categoryCount', { header: 'Categorías' }),
      columnHelper.display({
        id: 'acciones',
        header: '',
        cell: ({ row }) => (
          <Link to="/tournaments/$id/groups" params={{ id: row.original.id }}>
            Abrir
          </Link>
        ),
      }),
    ],
    [],
  )

  const table = useReactTable({ data: list, columns, getCoreRowModel: getCoreRowModel() })

  return (
    <Stack gap="md">
      <Title order={2}>Torneos</Title>

      <Group gap="sm" wrap="wrap">
        <TextInput
          placeholder="Nombre del torneo"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextInput
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Button
          disabled={!name.trim()}
          onClick={() => {
            const trimmed = name.trim()
            setName('')
            void newTournament(trimmed, date).then(() => {
              const id = useTournamentStore.getState().current!.id
              void navigate({ to: '/tournaments/$id/groups', params: { id } })
            })
          }}
        >
          Nuevo torneo
        </Button>
        <Button
          variant="default"
          onClick={() => void newMockTournament()}
          title="Crea 'Torneo FMP' con los datos de mock_players.json"
        >
          Crear torneo mock
        </Button>
      </Group>

      {list.length === 0 ? (
        <Text c="dimmed" size="sm">
          Todavía no hay torneos. Creá el primero.
        </Text>
      ) : (
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
      )}
    </Stack>
  )
}
