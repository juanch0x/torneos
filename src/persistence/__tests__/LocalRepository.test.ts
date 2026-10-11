import { beforeEach, describe, expect, it, vi } from 'vitest'
import { get, set } from 'idb-keyval'
import { createTournament } from '../../domain/factories'
import { LocalRepository } from '../LocalRepository'

vi.mock('idb-keyval', () => ({ get: vi.fn(), set: vi.fn(), del: vi.fn() }))
const documents = new Map<string, unknown>()
beforeEach(() => {
  documents.clear()
  vi.clearAllMocks()
  vi.mocked(get).mockImplementation(async key => documents.get(String(key)))
  vi.mocked(set).mockImplementation(async (key, value) => { documents.set(String(key), value) })
})
describe('calendar period metadata', () => {
  it('saves no period until configured and projects both calendar dates afterward', async () => {
    const repo = new LocalRepository()
    const tournament = createTournament('Club')
    await repo.save(tournament)
    expect((await repo.list())[0]).not.toHaveProperty('date')
    expect((await repo.list())[0].periodStart).toBeUndefined()
    tournament.calendar = { startDate: '2026-10-12', endDate: '2026-10-26', defaultWindow: { startsAt: '09:00', endsAt: '22:00' }, overrides: [] }
    await repo.save(tournament)
    expect((await repo.list())[0]).toMatchObject({ periodStart: '2026-10-12', periodEnd: '2026-10-26' })
  })
  it('loads legacy date keys without migration and derives the list period from the document', async () => {
    const repo = new LocalRepository()
    const tournament = { ...createTournament('Old'), date: '1999-01-01', calendar: { startDate: '2026-10-12', endDate: '2026-10-26', defaultWindow: { startsAt: '09:00', endsAt: '22:00' }, overrides: [] } }
    documents.set(`tournament:v2:${tournament.id}`, tournament)
    documents.set('tournaments:v2:index', [{ id: tournament.id, name: 'Old', date: '1999-01-01', categoryCount: 0, updatedAt: tournament.updatedAt }])
    expect(await repo.load(tournament.id)).toEqual(tournament)
    expect((await repo.list())[0]).toMatchObject({ periodStart: '2026-10-12', periodEnd: '2026-10-26' })
    expect((await repo.list())[0]).not.toHaveProperty('date')
    expect(set).not.toHaveBeenCalled()
  })
  it('does not load document when index entry already has periodStart', async () => {
    const repo = new LocalRepository()
    documents.set('tournaments:v2:index', [{ id: 't1', name: 'With Period', categoryCount: 1, updatedAt: '2026-10-10', periodStart: '2026-10-12', periodEnd: '2026-10-26' }])
    const loadSpy = vi.spyOn(repo, 'load')
    const list = await repo.list()
    expect(list[0]).toMatchObject({ id: 't1', name: 'With Period', periodStart: '2026-10-12', periodEnd: '2026-10-26' })
    expect(loadSpy).not.toHaveBeenCalled()
  })
  it('falls back to index metadata when legacy document load throws or is missing', async () => {
    const repo = new LocalRepository()
    documents.set('tournaments:v2:index', [{ id: 'missing', name: 'Broken', categoryCount: 0, updatedAt: '2026-10-10' }])
    vi.spyOn(repo, 'load').mockRejectedValueOnce(new Error('idb error'))
    const list = await repo.list()
    expect(list[0]).toMatchObject({ id: 'missing', name: 'Broken' })
    expect(list[0].periodStart).toBeUndefined()
  })
})
