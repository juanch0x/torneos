import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTournamentStore } from './tournamentStore'
import { createPreparationAutosave } from './autosave'
import { sample } from '../domain/__tests__/fixtures/v2Tournament'
describe('preparation ownership',()=> {
 beforeEach(()=>{ useTournamentStore.setState({current:sample(), revision:0, editsEnabled:true}) })
 it('does not save hydration, flushes the last edit before debounce', async()=>{ const save=vi.fn().mockResolvedValue(undefined); const writer=createPreparationAutosave(useTournamentStore,{save}); useTournamentStore.setState({current:sample()}); await writer.flush(); expect(save).not.toHaveBeenCalled(); useTournamentStore.getState().updatePair('c','a','Last','Edit'); await writer.flush(); expect(save).toHaveBeenCalledTimes(1); expect(save.mock.calls[0][0].categories[0].pairs[0].player1).toBe('Last'); writer.stop() })
 it('drains in-flight and latest revision; failed flush remains retryable',async()=> {let resolve!:()=>void; const save=vi.fn().mockImplementationOnce(()=>new Promise<void>(r=>resolve=r)).mockResolvedValue(undefined); const writer=createPreparationAutosave(useTournamentStore,{save});useTournamentStore.getState().updatePair('c','a','First','Edit');const flush=writer.flush();await Promise.resolve();useTournamentStore.getState().updatePair('c','a','Second','Edit');resolve();await flush;expect(save).toHaveBeenCalledTimes(2);save.mockRejectedValueOnce(new Error('denied'));useTournamentStore.getState().updatePair('c','a','Third','Edit');await expect(writer.flush()).rejects.toThrow('denied');await writer.flush();expect(save).toHaveBeenCalledTimes(4);writer.stop() })
 it('frozen edits cannot mutate the legacy document',()=> { useTournamentStore.setState({editsEnabled:false});useTournamentStore.getState().updatePair('c','a','Lost','Edit');expect(useTournamentStore.getState().current?.categories[0].pairs[0].player1).toBe('Ada') })
})
