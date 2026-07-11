import { useState } from 'react'
import { Alert, Button, Group, NumberInput, Paper, Stack, Text, TextInput, Title } from '@mantine/core'
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
      <Paper p={{ base: 'md', sm: 'lg' }}>
        <Stack gap="md">
          <Stack gap={4}>
            <Title order={2}>Categorías</Title>
            <Text c="dimmed" size="sm">
              Creá cada categoría y definí cuántos grupos necesitás antes de cargar las parejas.
            </Text>
          </Stack>

          <Group gap="sm" align="flex-end" wrap="wrap">
          <TextInput
            label="Nombre"
            placeholder="Nombre de categoría (ej: Núcleo)"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            style={{ flex: '1 1 18rem' }}
          />
          <NumberInput
            label="Grupos"
            min={1}
            style={{ width: '7rem' }}
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
        </Stack>
      </Paper>

      {current.categories.length === 0 ? (
        <Alert title="Todavía no hay categorías">
          Empezá creando la primera categoría para poder repartir grupos y cargar parejas.
        </Alert>
      ) : (
        current.categories.map((category) => <CategoryPanel key={category.id} category={category} />)
      )}
    </Stack>
  )
}
