import { useState } from 'react'
import {
  ActionIcon,
  Button,
  Card,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import type { V2SetupCategoryDraft, V2CategoryRemovalImpact } from '../../domain/v2Setup'
import {
  addGroup,
  newCategoryDraft,
  removeCategory,
  removeGroup,
  renameCategory,
  renameGroup,
} from './categoriesDraft'

// Inline SVG icons (project does not depend on @tabler/icons-react)
function IconTrash({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  )
}
function IconPlus({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}
export interface CategoriesEditorProps {
  value: V2SetupCategoryDraft[]
  onChange: (next: V2SetupCategoryDraft[]) => void
  disabled: boolean
  impact: (categoryId: string) => V2CategoryRemovalImpact
  groupPairCount: (groupId: string) => number
}

// ── Removal confirmation modal ────────────────────────────────────────────────

interface RemoveCategoryModalProps {
  opened: boolean
  impact: V2CategoryRemovalImpact
  onCancel: () => void
  onConfirm: () => void
}

function RemoveCategoryModal({ opened, impact, onCancel, onConfirm }: RemoveCategoryModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      centered
      size="sm"
      title="¿Eliminar categoría?"
    >
      <Stack>
        <Text size="sm">
          Se eliminarán la categoría con sus{' '}
          <strong>{impact.groups} {impact.groups === 1 ? 'grupo' : 'grupos'}</strong>,{' '}
          <strong>{impact.pairs} {impact.pairs === 1 ? 'pareja' : 'parejas'}</strong> y{' '}
          <strong>{impact.restrictions} {impact.restrictions === 1 ? 'restricción' : 'restricciones'}</strong>.
          Las demás categorías quedan intactas.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel}>
            Cancelar
          </Button>
          <Button color="red" onClick={onConfirm}>
            Eliminar categoría
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

// ── Single category card ──────────────────────────────────────────────────────

interface CategoryCardProps {
  category: V2SetupCategoryDraft
  disabled: boolean
  groupPairCount: (groupId: string) => number
  onChange: (next: V2SetupCategoryDraft) => void
  onRemove: () => void
}

function CategoryCard({
  category,
  disabled,
  groupPairCount,
  onChange,
  onRemove,
}: CategoryCardProps) {
  const [pendingGroupRemoval, setPendingGroupRemoval] = useState<number | null>(null)
  const isSingleGroup = category.groups.length === 1

  function handleRemoveGroup(index: number) {
    onChange(removeGroup(category, index))
    // Indexes shift after any removal, so a pending confirmation would target another group.
    setPendingGroupRemoval(null)
  }

  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        {/* Category name + remove category button */}
        <Group gap="sm" align="flex-end" wrap="nowrap">
          <TextInput
            label="Nombre de la categoría"
            required
            value={category.name}
            onChange={(e) => onChange(renameCategory(category, e.target.value))}
            disabled={disabled}
            style={{ flex: 1 }}
          />
          {/* Saved categories confirm in the parent; unsaved ones are removed directly. */}
          <ActionIcon
            variant="subtle"
            color="red"
            size={44}
            aria-label="Eliminar categoría"
            disabled={disabled}
            onClick={onRemove}
          >
            <IconTrash size={18} />
          </ActionIcon>
        </Group>

        {/* Groups list */}
        <Stack gap="xs">
          {category.groups.map((group, index) => {
            const pairCount = group.id ? groupPairCount(group.id) : 0
            const showWarning = pendingGroupRemoval === index && pairCount > 0

            return (
              <Stack key={group.id ?? `new-${index}`} gap={4}>
                <Group gap="sm" align="flex-end" wrap="nowrap">
                  <TextInput
                    label={`Grupo ${index + 1}`}
                    value={group.name}
                    onChange={(e) => onChange(renameGroup(category, index, e.target.value))}
                    disabled={disabled}
                    style={{ flex: 1 }}
                  />
                  <Tooltip
                    label="Cada categoría necesita al menos un grupo."
                    disabled={!isSingleGroup}
                    position="left"
                  >
                    <span style={{ display: 'inline-flex' }}>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size={44}
                        aria-label={`Eliminar grupo ${group.name}`}
                        disabled={disabled || isSingleGroup}
                        onClick={() => {
                          if (pairCount > 0) {
                            // Show inline warning first; second click confirms
                            setPendingGroupRemoval(index)
                          } else {
                            handleRemoveGroup(index)
                          }
                        }}
                      >
                        <IconTrash size={18} />
                      </ActionIcon>
                    </span>
                  </Tooltip>
                </Group>

                {showWarning && (
                  <Text size="xs" c="orange">
                    Sus {pairCount} {pairCount === 1 ? 'pareja quedará' : 'parejas quedarán'} sin asignar; se conservan sus restricciones.{' '}
                    <Button
                      variant="subtle"
                      color="red"
                      size="compact-xs"
                      disabled={disabled}
                      onClick={() => handleRemoveGroup(index)}
                    >
                      Confirmar eliminación
                    </Button>
                    {' '}
                    <Button
                      variant="subtle"
                      size="compact-xs"
                      onClick={() => setPendingGroupRemoval(null)}
                    >
                      Cancelar
                    </Button>
                  </Text>
                )}
              </Stack>
            )
          })}
        </Stack>

        {/* Add group button */}
        <Button
          variant="subtle"
          size="sm"
          leftSection={<IconPlus size={16} />}
          disabled={disabled}
          onClick={() => onChange(addGroup(category))}
        >
          Agregar grupo
        </Button>
      </Stack>
    </Card>
  )
}

// ── Public component ──────────────────────────────────────────────────────────

export function CategoriesEditor({
  value,
  onChange,
  disabled,
  impact,
  groupPairCount,
}: CategoriesEditorProps) {
  // { index, impact } of the saved category pending confirmation
  const [pendingRemoval, setPendingRemoval] = useState<{
    index: number
    impact: V2CategoryRemovalImpact
  } | null>(null)

  function handleCategoryChange(index: number, next: V2SetupCategoryDraft) {
    onChange(value.map((cat, i) => (i === index ? next : cat)))
  }

  function handleRemoveCategory(index: number) {
    const cat = value[index]
    if (cat.id) {
      // Saved → show confirmation modal
      setPendingRemoval({ index, impact: impact(cat.id) })
    } else {
      // New → remove directly
      onChange(removeCategory(value, index))
    }
  }

  function confirmRemoval() {
    if (pendingRemoval === null) return
    onChange(removeCategory(value, pendingRemoval.index))
    setPendingRemoval(null)
  }

  return (
    <Stack gap="md">
      {value.map((category, index) => (
        <CategoryCard
          key={category.id ?? `new-${index}`}
          category={category}
          disabled={disabled}
          groupPairCount={groupPairCount}
          onChange={(next) => handleCategoryChange(index, next)}
          onRemove={() => handleRemoveCategory(index)}
        />
      ))}

      <Button
        variant="subtle"
        leftSection={<IconPlus size={16} />}
        disabled={disabled}
        onClick={() => onChange([...value, newCategoryDraft()])}
      >
        Agregar categoría
      </Button>

      {pendingRemoval !== null && (
        <RemoveCategoryModal
          opened
          impact={pendingRemoval.impact}
          onCancel={() => setPendingRemoval(null)}
          onConfirm={confirmRemoval}
        />
      )}
    </Stack>
  )
}
