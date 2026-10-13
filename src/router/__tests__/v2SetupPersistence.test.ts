import { describe, expect, it, vi } from 'vitest'
import { sample } from '../../domain/__tests__/fixtures/v2Tournament'
import { isV2SetupLocked, type V2SetupDraft } from '../../domain/v2Setup'
import { createV2SessionStore } from '../../store/v2Session'
import { createV2Reader } from '../v2ReadService'
import { createV2SessionController } from '../v2SessionController'

const baselineConfig = {
  startDate: '2026-10-05',
  endDate: '2026-10-06',
  opensAt: '09:00',
  closesAt: '16:00',
  tournamentOpensAt: '09:00',
  tournamentClosesAt: '16:00',
  duration: '30',
  automaticWeekdays: [1, 2, 3, 4, 5],
}

function unlockedSample() {
  const s = sample()
  s.slots.forEach(slot => {
    delete slot.matchId
  })
  s.categories.forEach(cat => {
    cat.matches.forEach(m => {
      delete m.scheduledAt
      delete m.result
    })
  })
  return s
}

function setup(tournament = unlockedSample()) {
  let source = structuredClone(tournament)
  const repository = {
    list: vi.fn().mockResolvedValue([]),
    load: vi.fn(async () => structuredClone(source)),
    save: vi.fn(async (document: typeof source) => { source = structuredClone(document) }),
  }
  const store = createV2SessionStore()
  const reader = createV2Reader(repository)
  const controller = createV2SessionController(store, reader, repository)
  const expected = () => ({ sourceId: source.id, epoch: store.getState().epoch })
  return { source, repository, store, reader, controller, expected }
}

describe('V2 setup persistence controller', () => {
  it('saveSetup on an unlocked tournament saves once, updates working store, and isolates draft mutations', async () => {
    const { repository, store, controller, expected } = setup()
    await controller.open('t')

    const draft: V2SetupDraft = {
      ...baselineConfig,
      categories: [
        {
          id: 'c',
          name: 'Renamed Category',
          groups: [{ id: 'g', name: 'Renamed Group' }],
        },
      ],
    }

    const token = expected()
    // Mutate draft after initiating save
    const source = await repository.load()
    let resolve!: (doc: typeof source) => void
    repository.load.mockImplementationOnce(() => new Promise(r => { resolve = r }))

    const pending = controller.saveSetup(draft, token)
    draft.categories[0].name = 'Mutated Leaked Name'
    resolve(source)

    const res = await pending
    expect(res.ok).toBe(true)
    expect(repository.save).toHaveBeenCalledTimes(1)
    const working = store.getState().working!
    expect(working.categories[0].name).toBe('Renamed Category')
    expect(working.categories[0].groups[0].name).toBe('Renamed Group')
  })

  it('rejects invalid draft (no categories) without saving and sets saveError', async () => {
    const { repository, store, controller, expected } = setup()
    await controller.open('t')

    const draft: V2SetupDraft = {
      ...baselineConfig,
      categories: [],
    }

    const res = await controller.saveSetup(draft, expected())
    expect(res.ok).toBe(false)
    expect(repository.save).not.toHaveBeenCalled()
    expect(store.getState().saveError).toBe('Agregá al menos una categoría.')
  })

  it('locked tournament rejects saveSetup and saveConfiguration with ok: false and saves nothing', async () => {
    const locked = sample() // sample() has slot.matchId and match.scheduledAt / result -> locked
    expect(isV2SetupLocked(locked)).toBe(true)
    const { repository, controller, expected } = setup(locked)
    await controller.open('t')

    const setupDraft: V2SetupDraft = {
      ...baselineConfig,
      categories: [
        {
          id: 'c',
          name: 'Cat',
          groups: [{ id: 'g', name: 'Grp' }],
        },
      ],
    }

    const setupRes = await controller.saveSetup(setupDraft, expected())
    expect(setupRes.ok).toBe(false)
    if (!setupRes.ok) {
      expect(setupRes.error).toBe('La configuración es de solo lectura después de la primera generación del calendario.')
    }
    expect(repository.save).not.toHaveBeenCalled()

    const configRes = await controller.saveConfiguration(baselineConfig, expected())
    expect(configRes.ok).toBe(false)
    if (!configRes.ok) {
      expect(configRes.error).toBe('La configuración es de solo lectura después de la primera generación del calendario.')
    }
    expect(repository.save).not.toHaveBeenCalled()
  })

  it('savePairRestrictions still works on a locked tournament with complete configuration', async () => {
    const locked = sample()
    const { repository, controller, expected } = setup(locked)
    await controller.open('t')

    const restrictionDraft = [
      { id: 'res-1', start: '2026-10-05T10:00:00.000', end: '2026-10-05T11:00:00.000', reason: 'Médico' },
    ]

    const res = await controller.savePairRestrictions('a', restrictionDraft, expected())
    expect(res.ok).toBe(true)
    expect(repository.save).toHaveBeenCalledTimes(1)
  })

  it('rejects saveSetup if source changed outside the view', async () => {
    const { repository, controller, expected } = setup()
    await controller.open('t')

    const draft: V2SetupDraft = {
      ...baselineConfig,
      categories: [
        {
          id: 'c',
          name: 'Cat',
          groups: [{ id: 'g', name: 'Grp' }],
        },
      ],
    }

    const currentDoc = await repository.load()
    repository.load.mockResolvedValueOnce({ ...currentDoc, name: 'Changed outside' })

    const res = await controller.saveSetup(draft, expected())
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error).toBe('El torneo cambió fuera de esta vista. Conservá tu borrador; releé el original y revisá los cambios antes de reintentar.')
    }
    expect(repository.save).not.toHaveBeenCalled()
  })
})
