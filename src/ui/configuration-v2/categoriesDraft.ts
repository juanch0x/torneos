import type { V2SetupCategoryDraft, V2SetupGroupDraft } from '../../domain/v2Setup'

// Pure helpers for the categories/groups section of the V2 setup draft.
// No mutation — every function returns a new object or array.

/** Returns the first unused group name in the alphabetical series.
 *  "Grupo A" … "Grupo Z", then "Grupo 27", "Grupo 28", … */
export function nextGroupName(groups: V2SetupGroupDraft[]): string {
  const used = new Set(groups.map((g) => g.name))

  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i) // 'A' … 'Z'
    const name = `Grupo ${letter}`
    if (!used.has(name)) return name
  }

  // Past Z: numeric suffix starting at 27
  let n = 27
  while (used.has(`Grupo ${n}`)) n++
  return `Grupo ${n}`
}

/** Returns a fresh, empty category draft with one default group. */
export function newCategoryDraft(): V2SetupCategoryDraft {
  return { name: '', groups: [{ name: 'Grupo A' }] }
}

/** Returns a new category with an additional group appended. */
export function addGroup(category: V2SetupCategoryDraft): V2SetupCategoryDraft {
  const name = nextGroupName(category.groups)
  return { ...category, groups: [...category.groups, { name }] }
}

/** Returns a new category without the group at `index`. */
export function removeGroup(category: V2SetupCategoryDraft, index: number): V2SetupCategoryDraft {
  return {
    ...category,
    groups: category.groups.filter((_, i) => i !== index),
  }
}

/** Returns a new category with its name replaced. */
export function renameCategory(
  category: V2SetupCategoryDraft,
  name: string,
): V2SetupCategoryDraft {
  return { ...category, name }
}

/** Returns a new category with the group at `index` renamed. */
export function renameGroup(
  category: V2SetupCategoryDraft,
  index: number,
  name: string,
): V2SetupCategoryDraft {
  return {
    ...category,
    groups: category.groups.map((g, i) => (i === index ? { ...g, name } : g)),
  }
}

/** Returns a new array of categories without the one at `index`. */
export function removeCategory(
  categories: V2SetupCategoryDraft[],
  index: number,
): V2SetupCategoryDraft[] {
  return categories.filter((_, i) => i !== index)
}
