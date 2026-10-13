import type { V2ConfigurationDraft } from './v2Configuration'

// Shared contract for the setup-first configuration flow (issue #67).
// Predicates (lock, completion, draft, removal impact) are implemented in this file;
// the structural mutation `applyV2Setup` lives in `v2SetupApply.ts`.

/** A group in the setup draft. Missing `id` means a new, empty group. */
export interface V2SetupGroupDraft { id?: string; name: string }

/** A category in the setup draft. Missing `id` means a new category. */
export interface V2SetupCategoryDraft { id?: string; name: string; groups: V2SetupGroupDraft[] }

/** Baseline scheduling fields plus the category/group structure. */
export interface V2SetupDraft extends V2ConfigurationDraft { categories: V2SetupCategoryDraft[] }

export interface V2CategoryRemovalImpact { groups: number; pairs: number; restrictions: number }

export type V2SetupResult<T> = { ok: true; document: T } | { ok: false; error: string }
