# API sync report — focus-timer-core — 2026-10-31

**Contract form:** typed IPC (`public-api.md`). `sad.md` declares `target_surfaces: [desktop-app]`,
with no backend. The interface this feature adds is the main ↔ renderer IPC, so the contract
takes the typed-signatures form instead of OpenAPI. `spectral lint` does not apply. There is no
`events.md`, because the SAD has no async flow (§6 *Flagged for later stages*). `timer:state` is
an in-process push, and the contract documents it in §3.

**Inputs:** `data-model.md` ✓ (no schema change: in-memory `TimerState` only) · `sad.md` §5, §6
Flows 1–9, §8 ✓ · `spec.md` §4, §5, §6.1 ✓ · feature ADR-0006, ADR-0007, ADR-0008 ✓ ·
`src/shared/ipc.ts`, `src/shared/result.ts`, `src/main/ipc.ts`, `src/preload/index.ts` ✓.

## A. Field origins

| schema_path | origin | confidence |
|---|---|---|
| `TimerSnapshot.revision` | ADR-0006 field list; ADR-0008; data-model `TimerState.revision` | high |
| `TimerSnapshot.phase` | ADR-0006; data-model `TimerState.phase` | high |
| `TimerSnapshot.status` | ADR-0006; data-model `TimerState.status` | high |
| `TimerSnapshot.durationMs` | ADR-0006; data-model `TimerState.durationMs` | high |
| `TimerSnapshot.remainingMs` | ADR-0006; data-model `TimerState.remainingMs` (paused); AC-04 | high |
| `TimerSnapshot.endsAt` | ADR-0006; ADR-0002; data-model `TimerState.endsAt` | high |
| `TimerSnapshot.completedInCycle` | ADR-0006; data-model `TimerState.completedInCycle`; AC-01, AC-07 | high |
| `TimerSnapshot.focusNumber` | ADR-0006; derived per AC-01 (`completed + 1` on focus, null on break) | high |
| `TimerSnapshot.focusSessionsPerCycle` | `DEFAULT_TIMER_CONFIG` (sad §5); AC-01 «of 4». **Not** in ADR-0006's list: added with owner approval 2026-10-31 | medium |
| `TimerSnapshot.notice` | ADR-0006 (`notice`); data-model `TimerState.notice` | high |
| `Notice.kind` | AC-06 (phase ended), AC-14 (ended while asleep). Shape chosen with owner 2026-10-31 | medium |
| `Notice.endedPhase` | AC-05, AC-14 (focus session / break ended) | medium |
| `Notice.counted` | AC-14 («was not counted»), AC-15 (00:10 focus counts) | medium |
| `TimerSnapshot.controls` | ADR-0006 (`controls`); AC-02b table; sad §5 `allowedControls()` | high |
| `Controls.*` | AC-02b columns, one per command | high |
| `TimerCommand.type` | spec §6.1 (exactly five commands); sad §5 union | high |
| `TimerCommand.revision` | ADR-0008 envelope | high |
| `TimerCommand.confirmed` | ADR-0008 (`restartCycle` only); AC-12 | high |
| `CommandOutcome.kind` | ADR-0008 (`applied` / `ignored` / `needsConfirmation`) | high |
| `CommandOutcome.snapshot` | ADR-0008 | high |
| `CommandOutcome.loss` | ADR-0008 (`loss?`); sad §5 `restartLoss()` | high |
| `RestartLoss.completedInCycle` | AC-12 («3 completed focus sessions») | high |
| `RestartLoss.phaseInProgress` | AC-12 («plus the phase in progress if there is one») | high |
| `CommandOutcome.reason` (`IgnoredReason`) | sad §6 Flow 4 alt 1 / alt 2; sad §8 type guard. **Not** in ADR-0008's outcome: added with owner approval 2026-10-31 | medium |
| `timerGetState` / `timerCommand` names | sad §5 *Internal decomposition* (`src/shared/ipc.ts`) | high |
| `timerState` event, `timer:state` channel | ADR-0007; architecture-map §Conventions | high |
| `onTimerState` | ADR-0007 | high |
| channels `timer:get-state`, `timer:command` | derived: `<area>:<kebab-name>`, like the existing `app:ping` | medium |

No field has a `low` origin.

## B. Drift checklist

1. **Operation ↔ data-model** *(core)* ✓. Both invokes and the event read or change the
   in-memory `TimerState` documented in `data-model.md`. No persisted entity is touched, which
   matches data-model's no-schema-change outcome.
2. **Error code ↔ repo error definition** *(core)* ✓, with a convention note. The repo has no
   error-code registry. Its form is `Result` with a free-text `error` for unexpected throws
   (`src/shared/result.ts`, `src/main/ipc.ts`). Expected failures are typed outcomes, never
   errors (CLAUDE.md, ADR-0008). So the contract adds no `module.error_name` codes. The closest
   thing is `IgnoredReason`, a closed union in `src/shared/timer.ts`. This is a deliberate
   divergence from the skill's default `{code, message, details?}` envelope: it follows the repo
   and imposes nothing new.
3. **Validation ↔ constraint** *(core)* ✓. There are no stored column constraints. Value ranges
   come from the rules and are stated as invariants in contract §1: `remainingMs` in
   `0..durationMs`, `completedInCycle` in `0..focusSessionsPerCycle`, `endsAt` set exactly when
   running. Runtime validation of inbound payloads is `isTimerCommand` (sad §8).
4. **Contract ↔ sequence** *(supporting)* ✓, with one follow-up. Every IPC message in §6 maps to
   the contract:
   - The Flow 3 «Asks for the current snapshot» and «Subscribes» steps map to `timerGetState`
     and `onTimerState`.
   - Each `alt` branch that returns an outcome maps to a row in contract §2's error-channel table.
   - Flow 7's «User cancels» branch sends nothing.
   - **Follow-up:** no flow shows the `{ ok: false }` branch (an unexpected throw in main) or what
     the window does with it. Saved as OQ-2.

**Flags this run:** 3 (`focusSessionsPerCycle`, `Notice` shape, `IgnoredReason`). That is ≥3, so
the run paused, and each flag was resolved with the owner. The resolution for each was «Fix (the
contract)» on the recommended option. Their upstream follow-through is OQ-1.

## C. Coverage cross-check (back-feed)

| AC | Contract surface | Note |
|---|---|---|
| AC-01 | `timerCommand` start; snapshot `focusNumber`, `focusSessionsPerCycle` | |
| AC-02 | `ignored` / `staleRevision` | |
| AC-02b | `Controls`; `ignored` / `notAllowed` | |
| AC-03 | none | One process per macOS account, by construction (Flow 3 alt 2). No IPC surface needed |
| AC-04 | pause / start; `remainingMs` frozen while paused | |
| AC-05 | `timer:state` with `notice` | The system notification and window raise are main-only (`signals.ts`) |
| AC-06 | `Notice` survives a hidden/closed window, because it is in state | The Dock bounce is main-only |
| AC-07 | `timer:state` after a phase end | |
| AC-08 | invariant: no outcome or event starts a phase | |
| AC-09 | `timer:state`; skip on a long break → `completedInCycle: 0` | |
| AC-10 | reset → `applied` | |
| AC-11 | skip → `applied`, `completedInCycle` unchanged | |
| AC-12 | restartCycle → `needsConfirmation` + `RestartLoss`, then `confirmed: true` | |
| AC-13 | `timerGetState` on mount; `endsAt` gives the correct first frame on reopen | The quit confirmation is main-only (native dialog, `quit-guard.ts`) |
| AC-14 | `Notice` `endedWhileAsleep`; `timer:state` on wake | |
| AC-15 | `timer:state` on the new day; any command first runs the new-day rule | |

Every operation maps to a §4 user story: `timerGetState` → US-01 and US-08; `timerCommand` →
US-01, US-02, US-04, US-06 and US-07; `timer:state` → US-03, US-05, US-09 and US-10. No orphan
operation, and no AC without a home.

## Open questions

- [ ] **OQ-1.** ADR-0006's snapshot field list (+ `focusSessionsPerCycle`, plus the `Notice`
  shape) and ADR-0008's outcome shape (+ `reason` on `ignored`) are now narrower than this
  contract. Add a short amendment note to each, since both are Accepted. — owner: `design`
  (Vasiliy), due: before the contract is finalized (before `tasks`)
- [ ] **OQ-2.** The window's reaction to `{ ok: false }` from `timerGetState` or `timerCommand` has
  no flow or screen. Default now: keep showing the last snapshot and log to the console. —
  owner: `screens` (Vasiliy), due: before the contract is finalized (before `tasks`)

## Notes

- `ping` stays in the contract unchanged. Its only consumer, `App.tsx`, stops using it in this
  step (sad §5). Removing it is a separate cleanup and not part of this contract.
- The snippets in `public-api.md` were checked by reading, not compiled. The types do not exist
  in `src/` yet, and `implement` will typecheck them.
