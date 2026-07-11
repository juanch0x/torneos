# Archive Report — guided-cockpit-next-action

**Archived on**: 2026-07-11  
**Artifact store**: OpenSpec + Engram history  
**Status**: Archived after implementation and verification

## What Shipped

The tournament layout now shows advisory next-action guidance based on observable tournament state. The guidance keeps tabs and URL navigation free, balances export as a supporting action, and guides the organizer toward in-app result entry and standings.

## Verification

- `pnpm test`: passed during apply/verify
- `npx tsc --noEmit -p tsconfig.app.json`: passed during apply/verify
- `pnpm build`: passed during apply/verify
- Runtime verification covered setup, fixture-ready, no-results, partial-results, standings-ready, tab switching, and deep links.

## Notes

The native dispatcher previously failed to recognize the verify report as clearly passing even after verification succeeded. The change was still implemented, verified, reviewed, committed, and later moved to archive for OpenSpec hygiene.

## Relevant Commits

- `fd96ae8 feat(ui): add tournament next-action guidance`
