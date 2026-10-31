import { useCallback, useEffect, useRef, useState } from 'react'
import type { CommandOutcome, TimerCommand, TimerSnapshot } from '@shared/timer'

/** How often the visible countdown re-reads the clock. */
const TICK_MS = 250

export interface TimerState {
  /** The newest snapshot main has sent, or null before the first one arrives. */
  snapshot: TimerSnapshot | null
  /** Time left now: computed from `endsAt` while running, the snapshot's value otherwise. */
  remainingMs: number
  /** Sends a command aimed at the held snapshot's revision. Null when it could not be sent. */
  send(
    type: TimerCommand['type'],
    options?: { confirmed?: boolean }
  ): Promise<CommandOutcome | null>
}

function remainingAt(snapshot: TimerSnapshot | null, now: number): number {
  if (!snapshot) return 0
  if (snapshot.status !== 'running' || snapshot.endsAt === null) return snapshot.remainingMs
  return Math.min(Math.max(snapshot.endsAt - now, 0), snapshot.durationMs)
}

const isVisible = () => document.visibilityState === 'visible'

/**
 * The window's view of the timer (ADR-0006). Keeps the snapshot with the highest revision from
 * either the `timer:state` broadcast or a command outcome (public-api.md §4), and counts down from
 * `endsAt` only while the window is visible.
 */
export function useTimerState(): TimerState {
  const [snapshot, setSnapshot] = useState<TimerSnapshot | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [visible, setVisible] = useState(isVisible)
  const held = useRef<TimerSnapshot | null>(null)

  const accept = useCallback((next: TimerSnapshot) => {
    if (held.current && next.revision < held.current.revision) return
    held.current = next
    setSnapshot(next)
    setNow(Date.now())
  }, [])

  useEffect(() => {
    let mounted = true
    // Subscribe first so no change between the pull and the subscription is missed.
    const unsubscribe = window.api.onTimerState(accept)
    void window.api.timerGetState().then((result) => {
      if (mounted && result.ok) accept(result.value)
    })
    return () => {
      mounted = false
      unsubscribe()
    }
  }, [accept])

  useEffect(() => {
    const onVisibilityChange = () => {
      setVisible(isVisible())
      setNow(Date.now())
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  const running = snapshot?.status === 'running'
  useEffect(() => {
    if (!running || !visible) return
    const interval = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(interval)
  }, [running, visible])

  const send = useCallback<TimerState['send']>(
    async (type, options) => {
      const current = held.current
      if (!current) return null
      const { revision } = current
      const command: TimerCommand =
        type === 'restartCycle'
          ? { type, revision, confirmed: options?.confirmed ?? false }
          : { type, revision }
      const result = await window.api.timerCommand(command)
      if (!result.ok) return null
      accept(result.value.snapshot)
      return result.value
    },
    [accept]
  )

  return { snapshot, remainingMs: remainingAt(snapshot, now), send }
}
