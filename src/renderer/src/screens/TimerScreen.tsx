import { useLayoutEffect, useRef, useState, type FocusEvent, type MouseEvent } from 'react'
import {
  lossMessage,
  type Controls,
  type Notice,
  type PhaseKind,
  type PhaseStatus,
  type RestartLoss,
  type TimerSnapshot
} from '@shared/timer'
import { Button } from '../components/ui/Button'
import { Dialog } from '../components/ui/Dialog'
import { useTimerState } from '../hooks/useTimerState'
import styles from './TimerScreen.module.css'

const PHASE_NAMES: Record<PhaseKind, string> = {
  focus: 'Focus session',
  shortBreak: 'Short break',
  longBreak: 'Long break'
}

const STATUS_NAMES: Record<PhaseStatus, string> = {
  ready: 'Ready',
  running: 'Running',
  paused: 'Paused'
}

/** `mm:ss`, rounding a partial second up so a fresh 25:00 phase reads 25:00, not 24:59. */
function formatRemaining(ms: number): string {
  const seconds = Math.ceil(Math.max(ms, 0) / 1000)
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

/** The heading names the phase; on a focus session it also says which one of the cycle (AC-01). */
function phaseTitle(snapshot: TimerSnapshot): string {
  if (snapshot.phase !== 'focus') return PHASE_NAMES[snapshot.phase]
  return `Focus session ${snapshot.focusNumber} of ${snapshot.focusSessionsPerCycle}`
}

/** The phase-end message (AC-06, AC-14). The window owns the wording. */
function noticeText(notice: Notice): string {
  const focus = notice.endedPhase === 'focus'
  if (notice.kind === 'endedWhileAsleep') {
    return focus
      ? 'Focus session ended while the Mac was asleep — not counted'
      : 'Break ended while the Mac was asleep'
  }
  return focus ? 'Focus session complete' : 'Break over'
}

/**
 * The second click of a double-click lands on whatever replaced the button by then, as a valid
 * command at the new revision, so it is dropped here (AC-02). A keyboard press has detail 0.
 */
function onSingleClick(action: () => void) {
  return (event: MouseEvent) => {
    if (event.detail <= 1) action()
  }
}

type ControlName = Exclude<keyof Controls, 'restartCycle'>

/** A Restart cycle waiting for the User: the loss and the revision it was judged at. */
interface PendingRestart {
  loss: RestartLoss
  revision: number
}

export function TimerScreen() {
  const { snapshot, remainingMs, send } = useTimerState()
  const [pendingRestart, setPendingRestart] = useState<PendingRestart | null>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const lastFocusedControl = useRef<HTMLElement | null>(null)

  // Reset and Skip can remove themselves (AC-02b). Focus would fall to <body>, so the next Tab
  // starts from the top; move it to the primary button, which is always there.
  useLayoutEffect(() => {
    const last = lastFocusedControl.current
    if (last && !last.isConnected && document.activeElement === document.body) {
      primaryRef.current?.focus()
    }
  })

  async function restartCycle() {
    const outcome = await send('restartCycle', { confirmed: false })
    if (outcome?.kind === 'needsConfirmation') {
      setPendingRestart({ loss: outcome.loss, revision: outcome.snapshot.revision })
    }
  }

  function confirmRestart() {
    if (!pendingRestart) return
    setPendingRestart(null)
    // Aimed at the state the dialog described: if it changed meanwhile, main ignores it as stale.
    void send('restartCycle', { confirmed: true, revision: pendingRestart.revision })
  }

  if (!snapshot) {
    return <p className={styles.placeholder}>Loading…</p>
  }

  const { controls, status } = snapshot
  const commands: { name: ControlName; label: string; primary?: boolean }[] = [
    { name: 'start', label: status === 'paused' ? 'Resume' : 'Start', primary: true },
    { name: 'pause', label: 'Pause', primary: true },
    { name: 'reset', label: 'Reset' },
    { name: 'skip', label: 'Skip' }
  ]

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        {/* Element Timing marks the first paint of the ready screen: the e2e launch-time check
            (spec §6) reads it, so it measures the app, not the test harness. */}
        <h1 className={styles.title} elementtiming="phase-title">
          {phaseTitle(snapshot)}
        </h1>
        {snapshot.phase !== 'focus' && (
          <p className={styles.cycle}>
            {snapshot.completedInCycle} of {snapshot.focusSessionsPerCycle} completed
          </p>
        )}
      </header>

      <div className={styles.clock}>
        <span role="timer" className={styles.countdown}>
          {formatRemaining(remainingMs)}
        </span>
        <span className={styles.status}>{STATUS_NAMES[status]}</span>
      </div>

      {snapshot.notice && (
        <p role="status" className={styles.notice}>
          {noticeText(snapshot.notice)}
        </p>
      )}

      <div
        className={styles.controls}
        onFocus={(event: FocusEvent<HTMLDivElement>) => {
          lastFocusedControl.current = event.target
        }}
        onBlur={(event: FocusEvent<HTMLDivElement>) => {
          // Forget a control the User moved focus away from, so a later removal doesn't pull focus
          // back. A window blur (the User switched apps) also fires blur, but focus stays on the
          // control, so it stays remembered: the phase usually ends while the User is away.
          // Judged once the event has settled, so a removed control is never forgotten mid-commit.
          const left = event.target
          queueMicrotask(() => {
            if (
              left.isConnected &&
              document.activeElement !== left &&
              lastFocusedControl.current === left
            ) {
              lastFocusedControl.current = null
            }
          })
        }}
      >
        {commands
          .filter(({ name }) => controls[name])
          .map(({ name, label, primary }) => (
            <Button
              // One key for the primary slot: the same button stays, so it keeps keyboard focus.
              key={primary ? 'primary' : name}
              ref={primary ? primaryRef : undefined}
              variant={primary ? 'primary' : 'secondary'}
              onClick={onSingleClick(() => void send(name))}
            >
              {label}
            </Button>
          ))}
        {controls.restartCycle && (
          <Button onClick={onSingleClick(() => void restartCycle())}>Restart cycle</Button>
        )}
      </div>

      <Dialog
        open={pendingRestart !== null}
        title="Restart the cycle?"
        confirmLabel="Restart cycle"
        onConfirm={confirmRestart}
        onCancel={() => setPendingRestart(null)}
      >
        {pendingRestart && lossMessage(pendingRestart.loss)}
      </Dialog>
    </div>
  )
}
