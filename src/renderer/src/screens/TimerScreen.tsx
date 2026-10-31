import type { Controls, Notice, PhaseKind, PhaseStatus, TimerSnapshot } from '@shared/timer'
import { Button } from '../components/ui/Button'
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

type ControlName = Exclude<keyof Controls, 'restartCycle'>

export function TimerScreen() {
  const { snapshot, remainingMs, send } = useTimerState()

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
        <h1 className={styles.title}>{phaseTitle(snapshot)}</h1>
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

      <div className={styles.controls}>
        {commands
          .filter(({ name }) => controls[name])
          .map(({ name, label, primary }) => (
            <Button
              key={name}
              variant={primary ? 'primary' : 'secondary'}
              onClick={() => void send(name)}
            >
              {label}
            </Button>
          ))}
        {controls.restartCycle && (
          <Button onClick={() => void send('restartCycle')}>Restart cycle</Button>
        )}
      </div>
    </div>
  )
}
