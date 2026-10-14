import { useState } from 'react'
import {
  ActionIcon,
  Button,
  Group,
  Modal,
  NumberInput,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import type { V2SetupCategoryDraft, V2CategoryRemovalImpact } from '../../domain/v2Setup'
import {
  newCategoryDraft,
  nextGroupName,
  removeCategory,
  renameCategory,
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

// ── resizeGroups helper ───────────────────────────────────────────────────────

import type { V2SetupGroupDraft } from '../../domain/v2Setup'

/**
 * Returns a new groups array resized to `count` (clamped 1..5).
 * - Increase: appends new groups named like the domain ("Grupo C"), no id.
 * - Decrease: drops groups from the end. Existing groups keep ids and names.
 * - NaN / empty input: returns groups unchanged.
 */
export function resizeGroups(
  groups: V2SetupGroupDraft[],
  count: number | string,
): V2SetupGroupDraft[] {
  const n = typeof count === 'string' ? parseInt(count, 10) : count
  if (!Number.isFinite(n) || Number.isNaN(n)) return groups
  const target = Math.min(5, Math.max(1, n))
  if (target === groups.length) return groups

  if (target < groups.length) {
    return groups.slice(0, target)
  }

  // target > groups.length: append new groups
  const result = [...groups]
  while (result.length < target) {
    result.push({ name: nextGroupName(result) })
  }
  return result
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CategoriesEditorProps {
  value: V2SetupCategoryDraft[]
  onChange: (next: V2SetupCategoryDraft[]) => void
  disabled: boolean
  impact: (categoryId: string) => V2CategoryRemovalImpact
  groupPairCount: (groupId: string) => number
  /** Returns an error string for the given field path, or undefined. */
  errors?: (path: string) => string | undefined
  /** Called on blur of name / count inputs. */
  onBlurField?: (path: string) => void
}

// ── Remove category modal ─────────────────────────────────────────────────────

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

// ── Reduce group count confirm modal ─────────────────────────────────────────

interface ReduceGroupsModalProps {
  opened: boolean
  affectedPairs: number
  onCancel: () => void
  onConfirm: () => void
}

function ReduceGroupsModal({ opened, affectedPairs, onCancel, onConfirm }: ReduceGroupsModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      centered
      size="sm"
      title="¿Reducir grupos?"
    >
      <Stack>
        <Text size="sm">
          <strong>{affectedPairs} {affectedPairs === 1 ? 'pareja quedará' : 'parejas quedarán'}</strong> sin grupo al eliminar
          {affectedPairs === 1 ? ' el grupo removido' : ' los grupos removidos'}.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel}>
            Cancelar
          </Button>
          <Button color="red" onClick={onConfirm}>
            Confirmar
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

// ── Single category row ───────────────────────────────────────────────────────

interface CategoryRowProps {
  category: V2SetupCategoryDraft
  index: number
  disabled: boolean
  groupPairCount: (groupId: string) => number
  onChange: (next: V2SetupCategoryDraft) => void
  onRemove: () => void
  errors?: (path: string) => string | undefined
  onBlurField?: (path: string) => void
}

function CategoryRow({
  category,
  index,
  disabled,
  groupPairCount,
  onChange,
  onRemove,
  errors,
  onBlurField,
}: CategoryRowProps) {
  const [pendingCount, setPendingCount] = useState<number | null>(null)

  function applyCount(count: number) {
    onChange({ ...category, groups: resizeGroups(category.groups, count) })
  }

  function handleCountChange(val: number | string) {
    const n = typeof val === 'string' ? parseInt(val, 10) : val
    if (!Number.isFinite(n) || Number.isNaN(n)) return
    const target = Math.min(5, Math.max(1, n))
    if (target >= category.groups.length) {
      applyCount(target)
      return
    }
    // Decreasing — check if any removed group has pairs
    const removedGroups = category.groups.slice(target)
    const affectedPairs = removedGroups.reduce(
      (sum, g) => sum + (g.id ? groupPairCount(g.id) : 0),
      0,
    )
    if (affectedPairs > 0) {
      setPendingCount(target)
    } else {
      applyCount(target)
    }
  }

  const nameError = errors?.(`categories.${index}.name`)
  const groupsError = errors?.(`categories.${index}.groups`)

  return (
    <>
      <Group gap="sm" align="flex-end" wrap="nowrap">
        <TextInput
          label="Nombre de la categoría"
          required
          value={category.name}
          onChange={(e) => onChange(renameCategory(category, e.target.value))}
          onBlur={() => onBlurField?.(`categories.${index}.name`)}
          disabled={disabled}
          error={nameError}
          style={{ flex: 1 }}
        />
        <NumberInput
          label="Grupos"
          min={1}
          max={5}
          step={1}
          allowDecimal={false}
          value={category.groups.length}
          onChange={handleCountChange}
          onBlur={() => onBlurField?.(`categories.${index}.groups`)}
          disabled={disabled}
          error={groupsError}
          style={{ width: 110 }}
        />
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

      {pendingCount !== null && (() => {
        const removedGroups = category.groups.slice(pendingCount)
        const affectedPairs = removedGroups.reduce(
          (sum, g) => sum + (g.id ? groupPairCount(g.id) : 0),
          0,
        )
        return (
          <ReduceGroupsModal
            opened
            affectedPairs={affectedPairs}
            onCancel={() => setPendingCount(null)}
            onConfirm={() => {
              applyCount(pendingCount)
              setPendingCount(null)
            }}
          />
        )
      })()}
    </>
  )
}

// ── Public component ──────────────────────────────────────────────────────────

export function CategoriesEditor({
  value,
  onChange,
  disabled,
  impact,
  groupPairCount,
  errors,
  onBlurField,
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

  const headerError = errors?.('categories')

  return (
    <Stack gap="md">
      {/* Header: title + add button */}
      <Group gap="xs" align="center">
        <Title order={2} size="h3" style={{ flex: 1 }}>
          Categorías
        </Title>
        <Tooltip label="Agregar categoría">
          <ActionIcon
            variant="subtle"
            aria-label="Agregar categoría"
            disabled={disabled}
            onClick={() => onChange([...value, newCategoryDraft()])}
          >
            <IconPlus size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {headerError && (
        <Text size="sm" c="red">
          {headerError}
        </Text>
      )}

      {value.map((category, index) => (
        <CategoryRow
          key={category.id ?? `new-${index}`}
          category={category}
          index={index}
          disabled={disabled}
          groupPairCount={groupPairCount}
          onChange={(next) => handleCategoryChange(index, next)}
          onRemove={() => handleRemoveCategory(index)}
          errors={errors}
          onBlurField={onBlurField}
        />
      ))}

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
