import { useMemo } from 'react'
import { Badge, Table, Text, Title } from '@mantine/core'
import type { Group, Match, Pair } from '../domain/types'
import { computeGroupStandings } from '../domain/standings'

interface StandingsTableProps {
  group: Group
  matches: Match[]
  pairs: Pair[]
}

// Maps pairId → "Player1 / Player2" display label.
function buildPairLabel(pairs: Pair[]): (id: string) => string {
  const map = new Map(pairs.map((p) => [p.id, `${p.player1} / ${p.player2}`]))
  return (id) => map.get(id) ?? id
}

/**
 * Renders the leaderboard for a single group.
 * Calls computeGroupStandings as a pure selector — no store reads, no side effects.
 */
export function StandingsTable({ group, matches, pairs }: StandingsTableProps) {
  const standings = useMemo(
    () => computeGroupStandings(group, matches),
    [group, matches],
  )

  const label = useMemo(() => buildPairLabel(pairs), [pairs])

  if (standings.length === 0) return null

  return (
    <div>
      <Title order={5} mt="sm" mb="xs">
        Posiciones — {group.name}
      </Title>
      <Table.ScrollContainer minWidth={480}>
        <Table striped withTableBorder withColumnBorders fz="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: '2.5rem', textAlign: 'center' }}>#</Table.Th>
              <Table.Th>Pareja</Table.Th>
              <Table.Th style={{ textAlign: 'center' }}>PJ</Table.Th>
              <Table.Th style={{ textAlign: 'center' }}>PG</Table.Th>
              <Table.Th style={{ textAlign: 'center' }}>PP</Table.Th>
              <Table.Th style={{ textAlign: 'center' }}>Dif</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {standings.map((row) => (
              <Table.Tr key={row.pairId}>
                <Table.Td style={{ textAlign: 'center' }}>
                  {row.rank === 1 ? (
                    <Badge color="yellow" variant="filled" size="sm">
                      {row.rank}
                    </Badge>
                  ) : (
                    <Text fw={500}>{row.rank}</Text>
                  )}
                </Table.Td>
                <Table.Td>{label(row.pairId)}</Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>{row.played}</Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>{row.won}</Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>{row.lost}</Table.Td>
                <Table.Td
                  style={{ textAlign: 'center' }}
                  c={row.pointDiff > 0 ? 'green' : row.pointDiff < 0 ? 'red' : undefined}
                >
                  {row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </div>
  )
}
