# Audit — data-model — focus-timer-core — 2026-10-31

## Outcome

**No schema change. Zero staged migrations.** This step persists nothing (spec §3; sad.md §4
choice 5, §6 *Flagged for later stages*, §8 *Persistence*). `data-model.md` documents the existing
`settings.json` v1 document and the in-memory `TimerState`, as a baseline for roadmap steps 7 and 9.

- Staged migrations under `docs/features/focus-timer-core/migrations/`: **none**. Nothing was
  written to the live migration chain (`src/main/store/migrations.ts`).
- Fast lane: `api` would also accept the no-schema-change skip of `data-model`. `api` itself is
  **not** N/A for this feature, because the IPC contract changes (`timerGetState`, `timerCommand`,
  the `timer:state` event: ADR-0007, ADR-0008).

## Conventions derived

| Source | Finding |
|---|---|
| architecture-map §Conventions, §Datastores | Versioned local JSON in `userData` via `src/main/store.ts`. `migration_tool: ""` |
| Repo ADR-0003 (Accepted) | JSON over SQLite. Atomic temp-file + rename writes. Pure `migrate_vN_to_vN+1` on load |
| Live code | `src/main/store/migrations.ts`: `runMigrations` + an empty `settingsMigrations`. `Settings` is `{ schemaVersion: 1 }` |

**Promote-time convention hint (for future steps, not this one):** migrations are not SQL files.
A schema change adds `migrate_v<N>_to_v<N+1>` to the file's `MigrationChain` keyed by `N`, bumps
`schemaVersion` in the `StoreDefinition` and the type, and adds a test. The next `settings.json`
step is `migrate_v1_to_v2` (`settingsMigrations[1]`). `history.json` does not exist yet, so
Statistics starts it at v1 with an empty chain.

**Divergence from the skill's default output:** the skill expects `.up.sql` / `.down.sql` pairs.
This repo has no SQL datastore, so a future staged change would be a TypeScript migration step
plus its test. Migrations are forward-only (CLAUDE.md), so there is no `.down` equivalent. The
rollback story is the quarantine-and-defaults path in `store.ts`, which runs when a document is
newer than the app. This doesn't affect this feature, but `implement` for steps 7 and 9 should
know it.

## Drift detection

| Domain type | Store | Finding |
|---|---|---|
| `Settings` (`src/main/store.ts`) | `settings.json` v1 | No drift: the only field is `schemaVersion` |
| `TimerState` (`src/shared/timer.ts`, not yet written) | none, in memory only | N/A, never persisted |

No `_drift/` fixes proposed.

## Self-check

| Check | Result |
|---|---|
| Naming matches the repo | ✓ camelCase JSON fields, as in `store.ts` |
| Down reversibility | ✓ N/A, no migrations |
| FK indexes | ✓ N/A, no relations or indexes in a JSON store |
| Convention adherence | ✓ follows ADR-0003. No convention imposed |
| `erDiagram` validity | ✓ structural lint (`mmdc` not installed): valid entity names, `type name "comment"` attribute lines, no relationship lines |

## TBDs

- The `TimerState` field list in `data-model.md` is design intent. The exact TypeScript shape is
  owned by `implement` (`src/shared/timer.ts`).

## Next stage

`/sdd:api focus-timer-core`
