import type { V2ReadinessIssue } from './v2Readiness'
import type { DailyTimeWindow, Match, PairUnavailableWindow } from './types'

/** Planning failures carry facts; presentation and local date formatting belong to the UI. */
export type V2PlanningIssue = V2ReadinessIssue
  | { code: 'initial-generation-blocked' | 'configuration-required' | 'match-limit' | 'duplicate-slots' | 'generation-limit' | 'slot-limit' | 'search-limit' | 'assignment-unverified' | 'regeneration-blocked' | 'move-identity' | 'move-played' | 'move-stale' | 'move-noop' | 'move-configuration' | 'move-inconsistent' | 'move-duplicate-slots' | 'move-period' | 'court-closed' | 'move-court-hours' | 'move-occupied' | 'undo-slot-stale' }
  | { code: 'category-format'; category: string }
  | { code: 'group-limit'; group: string }
  | { code: 'unexpected-match'; category: string; matchId: string }
  | { code: 'duplicate-match'; category: string; matchIds: string[] }
  | { code: 'invalid-restriction'; restrictionId: string }
  | { code: 'nonexistent-local-time'; day: string }
  | { code: 'no-eligible-days'; startDate: string; endDate: string; weekdays: number[] }
  | { code: 'no-match-slots'; match: Match; label: string; durationMinutes: number; startDate: string; endDate: string; automaticWindow: DailyTimeWindow; weekdays: number[]; restrictions: PairUnavailableWindow[] }
  | { code: 'insufficient-capacity'; matchCount: number; slotCount: number; weekdays: number[] }
  | { code: 'competing-matches'; matchCount: number; weekdays: number[] }
  | { code: 'match-restrictions'; match: Match; label: string; restrictions: PairUnavailableWindow[] }
  | { code: 'move-grid'; durationMinutes: number }
  | { code: 'restriction-conflict'; matchId: string; pairId: string; pair: string; restriction: PairUnavailableWindow }
