/**
 * The timer rules (ADR-0001). Pure: time and the local date are always inputs, never read here.
 * Main holds the state and carries out the effects; the window only displays snapshots.
 */

export type PhaseKind = 'focus' | 'shortBreak' | 'longBreak'
export type PhaseStatus = 'ready' | 'running' | 'paused'

/** Which controls the window offers right now (AC-02b). `start` also means Resume when paused. */
export interface Controls {
  start: boolean
  pause: boolean
  reset: boolean
  skip: boolean
  restartCycle: boolean
}

/**
 * The phase-end message on the timer screen (AC-06, AC-14, AC-15). It stays until the next
 * command or the next phase end. The window owns the wording.
 */
export interface Notice {
  /** `endedWhileAsleep`: the phase's end passed while the Mac was in system sleep (AC-14). */
  kind: 'phaseEnded' | 'endedWhileAsleep'
  endedPhase: PhaseKind
  /** True only for a focus session that counted as completed. Always false for a break. */
  counted: boolean
}

/** What a confirmed Restart cycle would throw away (AC-12). The quit guard uses it too (AC-13). */
export interface RestartLoss {
  /** Completed focus sessions that would no longer count toward the long break. */
  completedInCycle: number
  /** The running or paused phase that would end uncounted, or null when the phase is ready. */
  phaseInProgress: PhaseKind | null
}

/** Everything the window shows. Main pushes a full snapshot on every state change (ADR-0006). */
export interface TimerSnapshot {
  /** Increments on every state change, starts at 0 on launch (ADR-0008). */
  revision: number
  phase: PhaseKind
  status: PhaseStatus
  /** Full length of the current phase, in ms. */
  durationMs: number
  /** Time left when the snapshot was made. Running → informational: the window uses `endsAt`. */
  remainingMs: number
  /** Wall-clock epoch ms when the running phase ends. null unless status is 'running'. */
  endsAt: number | null
  completedInCycle: number
  /** The «N» of «focus session N of 4»: completedInCycle + 1 on a focus phase, null on a break. */
  focusNumber: number | null
  focusSessionsPerCycle: number
  notice: Notice | null
  controls: Controls
}

/** The only commands the window can send (spec §6.1). Each targets the revision the User saw. */
export type TimerCommand =
  | { type: 'start' | 'pause' | 'reset' | 'skip'; revision: number }
  | { type: 'restartCycle'; revision: number; confirmed: boolean }

/** What happened to a command. Expected failures are outcomes, not errors (ADR-0008). */
export type CommandOutcome =
  | { kind: 'applied'; snapshot: TimerSnapshot }
  | { kind: 'ignored'; reason: IgnoredReason; snapshot: TimerSnapshot }
  | { kind: 'needsConfirmation'; loss: RestartLoss; snapshot: TimerSnapshot }

export type IgnoredReason = 'staleRevision' | 'notAllowed' | 'malformed'

export interface TimerConfig {
  focusMs: number
  shortBreakMs: number
  longBreakMs: number
  focusSessionsPerCycle: number
}

/** Fixed until roadmap step 7 makes the durations configurable (sad.md §11). */
export const DEFAULT_TIMER_CONFIG: TimerConfig = {
  focusMs: 25 * 60_000,
  shortBreakMs: 5 * 60_000,
  longBreakMs: 15 * 60_000,
  focusSessionsPerCycle: 4
}

/** The timer as main holds it. In memory only, never persisted (data-model.md). */
export interface TimerState {
  revision: number
  phase: PhaseKind
  status: PhaseStatus
  completedInCycle: number
  /** `YYYY-MM-DD` local date the cycle began (AC-15). */
  cycleDate: string
  durationMs: number
  /** Running phase only (ADR-0002). */
  endsAt: number | null
  /** Paused phase only: the frozen time left (AC-04). */
  remainingMs: number | null
  /** Set by a sleep input while a phase runs (ADR-0005). */
  sleptAt: number | null
  notice: Notice | null
}

export function phaseDurationMs(phase: PhaseKind, config: TimerConfig): number {
  switch (phase) {
    case 'focus':
      return config.focusMs
    case 'shortBreak':
      return config.shortBreakMs
    case 'longBreak':
      return config.longBreakMs
  }
}

export function createInitialState(localDate: string, config: TimerConfig): TimerState {
  return {
    revision: 0,
    phase: 'focus',
    status: 'ready',
    completedInCycle: 0,
    cycleDate: localDate,
    durationMs: config.focusMs,
    endsAt: null,
    remainingMs: null,
    sleptAt: null,
    notice: null
  }
}

/** The AC-02b control table. */
export function allowedControls(phase: PhaseKind, status: PhaseStatus): Controls {
  switch (status) {
    case 'ready':
      return {
        start: true,
        pause: false,
        reset: false,
        skip: phase !== 'focus',
        restartCycle: true
      }
    case 'running':
      return { start: false, pause: true, reset: true, skip: true, restartCycle: true }
    case 'paused':
      return { start: true, pause: false, reset: true, skip: true, restartCycle: true }
  }
}

export function restartLoss(state: TimerState): RestartLoss {
  return {
    completedInCycle: state.completedInCycle,
    phaseInProgress: state.status === 'ready' ? null : state.phase
  }
}

export function isRestartLossEmpty(loss: RestartLoss): boolean {
  return loss.completedInCycle === 0 && loss.phaseInProgress === null
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Time left at `now`, clamped to `0..durationMs` (ADR-0002). */
export function remainingMsAt(state: TimerState, now: number): number {
  switch (state.status) {
    case 'ready':
      return state.durationMs
    case 'running':
      return clamp((state.endsAt ?? now) - now, 0, state.durationMs)
    case 'paused':
      return clamp(state.remainingMs ?? state.durationMs, 0, state.durationMs)
  }
}

export function toSnapshot(state: TimerState, now: number, config: TimerConfig): TimerSnapshot {
  return {
    revision: state.revision,
    phase: state.phase,
    status: state.status,
    durationMs: state.durationMs,
    remainingMs: remainingMsAt(state, now),
    endsAt: state.status === 'running' ? state.endsAt : null,
    completedInCycle: state.completedInCycle,
    focusNumber: state.phase === 'focus' ? state.completedInCycle + 1 : null,
    focusSessionsPerCycle: config.focusSessionsPerCycle,
    notice: state.notice,
    controls: allowedControls(state.phase, state.status)
  }
}

const SIMPLE_COMMANDS: readonly string[] = ['start', 'pause', 'reset', 'skip']

/** Main runs this on every `timerCommand` payload: the renderer is untrusted (spec §6.1). */
export function isTimerCommand(value: unknown): value is TimerCommand {
  if (typeof value !== 'object' || value === null) return false
  const { type, revision, confirmed } = value as Record<string, unknown>
  if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 0) return false
  if (type === 'restartCycle') return typeof confirmed === 'boolean'
  return typeof type === 'string' && SIMPLE_COMMANDS.includes(type)
}

/**
 * What can happen to the timer. Commands come from the window. The rest come from main:
 * `deadline` is the armed timeout (the running phase's `endsAt` or local midnight, ADR-0003),
 * `sleep` / `wake` are powerMonitor suspend / resume (ADR-0005), and `clockChanged` is a macOS
 * clock or time-zone change.
 */
export type TimerInput =
  | { kind: 'command'; command: TimerCommand }
  | { kind: 'deadline' }
  | { kind: 'sleep' }
  | { kind: 'wake' }
  | { kind: 'clockChanged' }

/**
 * Side effects main carries out after a transition, in order. A phase end gives one `notify`
 * then one `bounceDock` (AC-05, AC-06), never more per transition. Commands have none.
 */
export type TimerEffect =
  | {
      kind: 'notify'
      notice: Notice
      /** The phase now ready, so the notification can name it. */
      next: { phase: PhaseKind; focusNumber: number | null }
    }
  | { kind: 'bounceDock' }

/**
 * How the rules judged an input. Main turns it into a `CommandOutcome` with a snapshot. A system
 * input that changes nothing is `ignored` / `notAllowed`.
 */
export type RuleOutcome =
  | { kind: 'applied' }
  | { kind: 'ignored'; reason: Exclude<IgnoredReason, 'malformed'> }
  | { kind: 'needsConfirmation'; loss: RestartLoss }

export interface TransitionResult {
  state: TimerState
  effects: TimerEffect[]
  outcome: RuleOutcome
}

/**
 * The one entry point of the rules (ADR-0001). `now` is epoch ms and `localDate` the Mac's local
 * `YYYY-MM-DD`; both come from main's clock. An input that changes nothing returns the same state
 * object. The new-day rule (AC-15) runs in every transition: before a command is judged, so a
 * command aimed at yesterday's phase is stale, and after a system input, so a sleep result or a
 * phase end applies first. A running phase that is already due ends before a command is judged too,
 * so a command that overtook the deadline or the wake input can't act on the finished phase.
 */
export function transition(
  state: TimerState,
  input: TimerInput,
  now: number,
  localDate: string,
  config: TimerConfig
): TransitionResult {
  if (input.kind === 'command') {
    if (state.status === 'running' && state.endsAt !== null && now >= state.endsAt) {
      // A command proves the Mac is awake, so the wake rule decides how the phase ended.
      const settled = transition(state, { kind: 'wake' }, now, localDate, config)
      const judged = applyCommand(settled.state, input.command, now, localDate, config)
      return { ...judged, effects: settled.effects }
    }
    return applyCommand(
      startNewDay(state, localDate, config),
      input.command,
      now,
      localDate,
      config
    )
  }

  const settled = applySystemInput(state, input, now, localDate, config)
  // Only a phase end bumps the revision here; sleep and wake-while-running change nothing visible.
  const endedNotice = settled.revision !== state.revision ? settled.notice : null
  let next = startNewDay(settled, localDate, config)
  // A phase that ended in this transition keeps its notice through a new-day reset.
  if (endedNotice && next !== settled) next = { ...next, notice: endedNotice }
  if (next === state) return ignored(state, 'notAllowed')

  const effects: TimerEffect[] = []
  if (endedNotice) {
    const focusNumber = next.phase === 'focus' ? next.completedInCycle + 1 : null
    effects.push(
      { kind: 'notify', notice: endedNotice, next: { phase: next.phase, focusNumber } },
      { kind: 'bounceDock' }
    )
  }
  return { state: next, effects, outcome: { kind: 'applied' } }
}

function applySystemInput(
  state: TimerState,
  input: Exclude<TimerInput, { kind: 'command' }>,
  now: number,
  localDate: string,
  config: TimerConfig
): TimerState {
  if (state.status !== 'running' || state.endsAt === null) return state
  switch (input.kind) {
    case 'deadline':
      // While asleep a deadline is a Power Nap wake: the wake input settles the phase instead.
      if (state.sleptAt !== null || now < state.endsAt) return state
      return endPhase(state, 'phaseEnded', localDate, config)
    case 'sleep':
      return state.sleptAt === null ? { ...state, sleptAt: now } : state
    case 'wake': {
      const { sleptAt, endsAt } = state
      const awake = sleptAt === null ? state : { ...state, sleptAt: null }
      if (now < endsAt) return awake
      // Counted only when the end came no later than the moment the Mac went to sleep (AC-14).
      const endedAsleep = sleptAt !== null && endsAt > sleptAt
      return endPhase(awake, endedAsleep ? 'endedWhileAsleep' : 'phaseEnded', localDate, config)
    }
    case 'clockChanged':
      return state
  }
}

/**
 * Settles the end of the running phase: only a focus session that ran out while the Mac was awake
 * counts (AC-07); the next phase waits ready (AC-08) with the phase-end notice.
 */
function endPhase(
  state: TimerState,
  kind: Notice['kind'],
  localDate: string,
  config: TimerConfig
): TimerState {
  const counted = state.phase === 'focus' && kind === 'phaseEnded'
  const completedInCycle = state.completedInCycle + (counted ? 1 : 0)
  let next: Partial<TimerState>
  if (state.phase === 'longBreak') next = freshCycle(localDate, config)
  else if (state.phase === 'shortBreak') next = readyPhase('focus', config)
  else if (completedInCycle >= config.focusSessionsPerCycle) next = readyPhase('longBreak', config)
  else next = readyPhase('shortBreak', config)

  const notice: Notice = { kind, endedPhase: state.phase, counted }
  return applied(state, { completedInCycle, ...next, notice }).state
}

/**
 * The new-day rule (AC-15): a cycle belongs to the local date it began on. A phase that is not
 * running on a later date gives way to a fresh cycle; a running phase is left alone until it ends.
 */
function startNewDay(state: TimerState, localDate: string, config: TimerConfig): TimerState {
  if (state.status === 'running' || localDate <= state.cycleDate) return state
  return applied(state, freshCycle(localDate, config)).state
}

function applyCommand(
  state: TimerState,
  command: TimerCommand,
  now: number,
  localDate: string,
  config: TimerConfig
): TransitionResult {
  if (command.revision !== state.revision) return ignored(state, 'staleRevision')
  if (!allowedControls(state.phase, state.status)[command.type]) return ignored(state, 'notAllowed')

  switch (command.type) {
    case 'start':
      return applied(state, {
        status: 'running',
        endsAt: now + (state.status === 'paused' ? remainingMsAt(state, now) : state.durationMs),
        remainingMs: null
      })
    case 'pause':
      return applied(state, {
        status: 'paused',
        remainingMs: remainingMsAt(state, now),
        endsAt: null,
        sleptAt: null
      })
    case 'reset':
      return applied(state, readyPhase(state.phase, config))
    case 'skip':
      return applied(state, phaseAfterSkip(state, localDate, config))
    case 'restartCycle': {
      const loss = restartLoss(state)
      if (!command.confirmed && !isRestartLossEmpty(loss)) {
        return { state, effects: [], outcome: { kind: 'needsConfirmation', loss } }
      }
      return applied(state, freshCycle(localDate, config))
    }
  }
}

function phaseAfterSkip(
  state: TimerState,
  localDate: string,
  config: TimerConfig
): Partial<TimerState> {
  switch (state.phase) {
    case 'focus':
      // A skipped focus session never counts (AC-11), so it always leads to a short break.
      return readyPhase('shortBreak', config)
    case 'shortBreak':
      return readyPhase('focus', config)
    case 'longBreak':
      return freshCycle(localDate, config)
  }
}

function readyPhase(phase: PhaseKind, config: TimerConfig): Partial<TimerState> {
  return {
    phase,
    status: 'ready',
    durationMs: phaseDurationMs(phase, config),
    endsAt: null,
    remainingMs: null,
    sleptAt: null
  }
}

function freshCycle(localDate: string, config: TimerConfig): Partial<TimerState> {
  return { ...readyPhase('focus', config), completedInCycle: 0, cycleDate: localDate }
}

function applied(state: TimerState, changes: Partial<TimerState>): TransitionResult {
  return {
    state: { ...state, notice: null, ...changes, revision: state.revision + 1 },
    effects: [],
    outcome: { kind: 'applied' }
  }
}

function ignored(state: TimerState, reason: 'staleRevision' | 'notAllowed'): TransitionResult {
  return { state, effects: [], outcome: { kind: 'ignored', reason } }
}
