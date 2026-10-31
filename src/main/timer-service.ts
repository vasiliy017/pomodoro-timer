import {
  createInitialState,
  DEFAULT_TIMER_CONFIG,
  isTimerCommand,
  restartLoss,
  toSnapshot,
  transition,
  type CommandOutcome,
  type RestartLoss,
  type TimerConfig,
  type TimerEffect,
  type TimerInput,
  type TimerSnapshot
} from '@shared/timer'
import type { Clock } from './clock'
import type { Signals } from './signals'

export interface TimerServiceOptions {
  clock: Clock
  signals: Pick<Signals, 'notify' | 'bounceDock'>
  /** Sends a snapshot to every open window (`timer:state`). */
  broadcast(snapshot: TimerSnapshot): void
  config?: TimerConfig
}

export interface TimerService {
  getSnapshot(): TimerSnapshot
  /** Runs a command from the window. The payload is untrusted (spec §6.1). */
  command(payload: unknown): CommandOutcome
  sleep(): void
  wake(): void
  clockChanged(): void
  getRestartLoss(): RestartLoss
  dispose(): void
}

/**
 * The imperative shell around the timer rules (ADR-0001): holds the one `TimerState`, feeds each
 * input with the clock's time, carries out the effects, broadcasts a snapshot when the state
 * changed, and keeps exactly one timeout armed at the next deadline (ADR-0003).
 */
export function createTimerService(options: TimerServiceOptions): TimerService {
  const { clock, signals, broadcast, config = DEFAULT_TIMER_CONFIG } = options
  let state = createInitialState(clock.localDate(), config)
  let timeout: ReturnType<typeof setTimeout> | undefined

  const snapshot = () => toSnapshot(state, clock.now(), config)

  function apply(input: TimerInput) {
    const result = transition(state, input, clock.now(), clock.localDate(), config)
    const changed = result.state.revision !== state.revision
    state = result.state
    for (const effect of result.effects) runEffect(effect)
    if (changed) {
      try {
        broadcast(snapshot())
      } catch (error) {
        console.error('[timer] broadcast failed', error)
      }
    }
    rearm()
    return result
  }

  function runEffect(effect: TimerEffect) {
    try {
      if (effect.kind === 'notify') signals.notify(effect.notice, effect.next)
      else signals.bounceDock()
    } catch (error) {
      console.error(`[timer] ${effect.kind} failed`, error)
    }
  }

  /** One timeout at the earlier of the phase end and the next local midnight. */
  function rearm() {
    clearTimeout(timeout)
    const now = clock.now()
    // While asleep the wake input settles the phase, so only midnight is armed (Power Nap).
    const phaseEnd = state.sleptAt === null ? (state.endsAt ?? Infinity) : Infinity
    const target = Math.min(phaseEnd, clock.nextLocalMidnight(now))
    timeout = setTimeout(() => apply({ kind: 'deadline' }), Math.max(0, target - now))
  }

  rearm()

  return {
    getSnapshot: snapshot,

    command(payload) {
      if (!isTimerCommand(payload)) {
        return { kind: 'ignored', reason: 'malformed', snapshot: snapshot() }
      }
      const { outcome } = apply({ kind: 'command', command: payload })
      return { ...outcome, snapshot: snapshot() }
    },

    sleep: () => void apply({ kind: 'sleep' }),
    wake: () => void apply({ kind: 'wake' }),
    clockChanged: () => void apply({ kind: 'clockChanged' }),
    getRestartLoss: () => restartLoss(state),

    dispose() {
      clearTimeout(timeout)
      timeout = undefined
    }
  }
}
