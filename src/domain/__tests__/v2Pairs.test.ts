import { describe, expect, it } from 'vitest'
import { sample } from './fixtures/v2Tournament'
import { addV2Pair, deleteV2Pair, renameV2Pair } from '../v2Pairs'
import type { Tournament } from '../types'

function prepared() { const t = sample(); t.slots = []; t.categories[0].matches = [{ id: 'm', groupId: 'g', pairAId: 'a', pairBId: 'b', round: 1 }]; return t }
function locked() { const t = prepared(); t.categories[0].matches[0].scheduledAt = '2026-10-05T09:00Z'; return t }
const category = (t: Tournament) => t.categories[0]

describe('addV2Pair', () => {
  it('adds a normalized pair to the unassigned pool', () => {
    const result = addV2Pair(prepared(), { categoryId: 'c', pairId: 'new', player1: ' Ana  María ', player2: 'Bruno' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(category(result.document).pairs.at(-1)).toEqual({ id: 'new', player1: 'Ana María', player2: 'Bruno' })
    expect(category(result.document).groups.flatMap(group => group.pairIds)).not.toContain('new')
  })
  it('is idempotent for the same id and names', () => {
    const first = addV2Pair(prepared(), { categoryId: 'c', pairId: 'new', player1: 'Ana', player2: 'Bruno' })
    if (!first.ok) throw new Error(first.error)
    expect(addV2Pair(first.document, { categoryId: 'c', pairId: 'new', player1: 'Ana', player2: 'Bruno' })).toEqual({ ok: true, document: first.document })
  })
  it('rejects an id collision with different content and any existing id', () => {
    expect(addV2Pair(prepared(), { categoryId: 'c', pairId: 'a', player1: 'Ana', player2: 'Bruno' }).ok).toBe(false)
    expect(addV2Pair(prepared(), { categoryId: 'c', pairId: 'g', player1: 'Ana', player2: 'Bruno' }).ok).toBe(false)
  })
  it('rejects invalid names with issues', () => {
    const result = addV2Pair(prepared(), { categoryId: 'c', pairId: 'new', player1: 'A', player2: 'Bruno' })
    expect(result.ok === false && result.issues?.[0].path).toBe('player1')
  })
  it('rejects unknown categories and a locked structure', () => {
    expect(addV2Pair(prepared(), { categoryId: 'nope', pairId: 'new', player1: 'Ana', player2: 'Bruno' }).ok).toBe(false)
    expect(addV2Pair(locked(), { categoryId: 'c', pairId: 'new', player1: 'Ana', player2: 'Bruno' }).ok).toBe(false)
  })
})

describe('renameV2Pair', () => {
  it('changes only the names, even while locked', () => {
    const source = locked()
    const result = renameV2Pair(source, { categoryId: 'c', pairId: 'a', player1: 'Ana', player2: 'Bruno' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const expected = structuredClone(source)
    const pair = category(expected).pairs.find(pair => pair.id === 'a')!
    pair.player1 = 'Ana'; pair.player2 = 'Bruno'
    expect(result.document).toEqual(expected)
  })
  it('rejects unknown pairs and invalid names', () => {
    expect(renameV2Pair(prepared(), { categoryId: 'c', pairId: 'nope', player1: 'Ana', player2: 'Bruno' }).ok).toBe(false)
    expect(renameV2Pair(prepared(), { categoryId: 'c', pairId: 'a', player1: 'Ana', player2: 'ana' }).ok).toBe(false)
  })
})

describe('deleteV2Pair', () => {
  it('removes the pair, its membership, its windows, and its crosses', () => {
    const t = prepared(); t.categories[0].groups[0].pairIds.push('free')
    t.categories[0].matches.push({ id: 'm2', groupId: 'g', pairAId: 'a', pairBId: 'free', round: 2 }, { id: 'm3', groupId: 'g', pairAId: 'b', pairBId: 'free', round: 3 })
    t.pairUnavailableWindows = [{ id: 'w1', pairId: 'a', startsAt: '2026-10-05T10:00:00Z', endsAt: '2026-10-05T11:00:00Z' }, { id: 'w2', pairId: 'b', startsAt: '2026-10-05T10:00:00Z', endsAt: '2026-10-05T11:00:00Z' }]
    const result = deleteV2Pair(t, { categoryId: 'c', pairId: 'a' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(category(result.document).pairs.map(pair => pair.id)).not.toContain('a')
    expect(category(result.document).groups[0].pairIds).toEqual(['b', 'free'])
    expect(category(result.document).matches.map(match => match.id)).toEqual(['m3'])
    expect(result.document.pairUnavailableWindows?.map(window => window.id)).toEqual(['w2'])
  })
  it('removes an unassigned pair without touching matches', () => {
    const t = prepared()
    const result = deleteV2Pair(t, { categoryId: 'c', pairId: 'free' })
    expect(result.ok && category(result.document).matches).toEqual(t.categories[0].matches)
  })
  it('rejects unknown pairs and a locked structure', () => {
    expect(deleteV2Pair(prepared(), { categoryId: 'c', pairId: 'nope' }).ok).toBe(false)
    expect(deleteV2Pair(locked(), { categoryId: 'c', pairId: 'a' }).ok).toBe(false)
  })
})
