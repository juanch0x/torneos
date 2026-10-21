// The app intentionally has no @types/node dependency. Tests that need to read repo
// files load node:fs through a computed specifier (same workaround as
// src/export/__tests__/planningSerialization.test.ts) so `tsc -p tsconfig.app.json`
// and `pnpm build` do not need Node typings.
const fsModule = 'node:fs'
const { readFileSync, readdirSync, statSync } = (await import(fsModule)) as {
  readFileSync: (path: URL, encoding: 'utf8') => string
  readdirSync: (path: URL) => string[]
  statSync: (path: URL) => { isDirectory(): boolean }
}

// This file lives in <repo>/src/ui/__tests__/, so the repo root is three levels up.
const repoRoot = new URL('../../../', import.meta.url)

/** Reads a UTF-8 file by repo-root-relative path (e.g. `src/index.css`). */
export function readRepoFile(relativePath: string): string {
  return readFileSync(new URL(relativePath, repoRoot), 'utf8')
}

/** Lists every file under a repo-root-relative directory, recursively (relative paths). */
export function listRepoFiles(relativeDir: string): string[] {
  const dir = relativeDir.endsWith('/') ? relativeDir : `${relativeDir}/`
  const out: string[] = []
  for (const name of readdirSync(new URL(dir, repoRoot))) {
    const rel = `${dir}${name}`
    if (statSync(new URL(rel, repoRoot)).isDirectory()) out.push(...listRepoFiles(rel))
    else out.push(rel)
  }
  return out
}
