import { useState } from 'react'
import { Button, Group, NumberInput, Paper, Stack, TextInput, Title } from '@mantine/core'
import { useTournamentStore } from '../store/tournamentStore'
import { CategoryPanel } from './CategoryPanel'

export function GroupsPage() {
  const current = useTournamentStore((s) => s.current)
  const addCategory = useTournamentStore((s) => s.addCategory)

  const [catName, setCatName] = useState('')
  const [numGroups, setNumGroups] = useState(1)

  // TournamentLayout already guarantees current is loaded before rendering children
  if (!current) return null

  return (
    <Stack gap="md">
      <Paper withBorder p="md">
        <Title order={2} mb="xs">
          Categorías
        </Title>
        <Group gap="sm" wrap="wrap">
          <TextInput
            placeholder="Nombre de categoría (ej: Núcleo)"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
          />
          <NumberInput
            label="Grupos:"
            min={1}
            style={{ width: '4rem' }}
            value={numGroups}
            onChange={(val) =>
              setNumGroups(Math.max(1, typeof val === 'number' ? val || 1 : 1))
            }
          />
          <Button
            disabled={!catName.trim()}
            onClick={() => {
              addCategory(catName.trim(), numGroups)
              setCatName('')
              setNumGroups(1)
            }}
          >
            Agregar categoría
          </Button>
        </Group>
      </Paper>

      {current.categories.map((category) => (
        <CategoryPanel key={category.id} category={category} />
      ))}
    </Stack>
  )
}
