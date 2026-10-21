import type { CSSProperties } from 'react'
import { ActionIcon, Badge, Group, Menu, Stack, Text } from '@mantine/core'
import { plural } from '../../domain/text'
import { ErrorIcon, WarningIcon } from '../icons'

// Menu.Item color="red" sets --menu-item-color (red-6) and --menu-item-hover inline, which
// defeats the theme override and renders 1.95:1 in dark. Set both variables directly instead.
const DANGER_ITEM_STYLE = {
  '--menu-item-color': 'var(--mantine-color-red-text)',
  '--menu-item-hover': 'var(--tn-row-hover)',
} as CSSProperties

export interface PairRowProps {
  label: string
  currentGroupId: string | null
  moveTargets: { id: string | null; name: string }[]
  moveDisabled: boolean
  actionsDisabled: boolean
  deleteDisabled: boolean
  restrictionCount: number
  restrictionsDisabled: boolean
  conflictCount: number
  pendingCount: number
  onMove: (groupId: string | null) => void
  onEditNames: () => void
  onRestrictions: () => void
  onDelete: () => void
}

export function PairRow(props: PairRowProps) {
  const { label, currentGroupId, moveTargets, restrictionCount, conflictCount, pendingCount } = props
  const restrictionsLabel = restrictionCount ? 'Ver restricciones' : 'Agregar restricciones'
  return <Group justify="space-between" align="center" wrap="nowrap" gap="sm" py={8}>
    <Stack gap={4} style={{ minWidth: 0 }}>
      <Text fw={600} size="sm" truncate="end" title={label}>{label}</Text>
      {(!!restrictionCount || !!conflictCount || !!pendingCount) && <Group gap={6}>
        {!!restrictionCount && <Badge component="button" type="button" variant="light" color={conflictCount ? 'red' : 'gray'} leftSection={conflictCount ? <ErrorIcon size={12} /> : undefined} size="sm" radius="sm" style={{ cursor: props.restrictionsDisabled ? 'default' : 'pointer' }} disabled={props.restrictionsDisabled} onClick={props.onRestrictions}>{plural(restrictionCount, 'restricción', 'restricciones')}</Badge>}
        {!!conflictCount && <Text size="xs" c="red"><ErrorIcon inline />{plural(conflictCount, 'conflicto', 'conflictos')}</Text>}
        {!!pendingCount && <Text size="xs" c="warning"><WarningIcon inline />{plural(pendingCount, 'partido', 'partidos')} sin validar</Text>}
      </Group>}
    </Stack>
    <Menu withinPortal loop position="bottom-end">
      <Menu.Target><ActionIcon variant="subtle" color="gray" aria-label={`Acciones para ${label}`} disabled={props.actionsDisabled}>⋯</ActionIcon></Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Mover a</Menu.Label>
        {moveTargets.map(target => { const current = target.id === currentGroupId; return <Menu.Item key={target.id ?? ''} disabled={current || props.moveDisabled} onClick={() => props.onMove(target.id)}>{target.name}{current ? ' · Actual' : ''}</Menu.Item> })}
        <Menu.Divider />
        <Menu.Item disabled={props.restrictionsDisabled} onClick={props.onRestrictions}>{restrictionsLabel}</Menu.Item>
        <Menu.Item onClick={props.onEditNames}>Editar nombres</Menu.Item>
        <Menu.Divider />
        <Menu.Item style={DANGER_ITEM_STYLE} disabled={props.deleteDisabled} onClick={props.onDelete}>Eliminar pareja</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  </Group>
}
