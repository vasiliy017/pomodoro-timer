import { app, Notification } from 'electron'
import type { Notice, PhaseKind } from '@shared/timer'

/** The phase now ready, as the timer rules' `notify` effect names it. */
export interface ReadyPhase {
  phase: PhaseKind
  focusNumber: number | null
}

function readyLabel({ phase, focusNumber }: ReadyPhase): string {
  switch (phase) {
    case 'focus':
      return `Focus session ${focusNumber ?? 1} ready`
    case 'shortBreak':
      return 'Short break ready'
    case 'longBreak':
      return 'Long break ready'
  }
}

/** The notification text for a phase end (AC-05, AC-14). Names phases only, never user data. */
export function phaseEndMessage(
  notice: Notice,
  ready: ReadyPhase
): { title: string; body: string } {
  const ended = notice.endedPhase === 'focus' ? 'Focus session' : 'Break'
  if (notice.kind === 'endedWhileAsleep') {
    const counted = notice.endedPhase === 'focus' ? 'Not counted. ' : ''
    return {
      title: `${ended} ended while the Mac was asleep`,
      body: `${counted}${readyLabel(ready)}`
    }
  }
  return {
    title: notice.endedPhase === 'focus' ? 'Focus session complete' : 'Break over',
    body: readyLabel(ready)
  }
}

export interface Signals {
  notify(notice: Notice, ready: ReadyPhase): void
  bounceDock(): void
  /** Notifications still held for their click handler. */
  pendingNotifications(): number
}

/**
 * The phase-end signals (sad.md §8): one notification, then one informational Dock bounce. A
 * notification click calls `onClick`; the app never raises the window by itself (AC-06).
 */
export function createSignals({ onClick }: { onClick: () => void }): Signals {
  // Held until closed or clicked so the click handler survives garbage collection.
  const pending = new Set<Notification>()

  return {
    notify(notice, ready) {
      if (!Notification.isSupported()) return
      const notification = new Notification(phaseEndMessage(notice, ready))
      notification.on('click', () => {
        pending.delete(notification)
        onClick()
      })
      notification.on('close', () => pending.delete(notification))
      pending.add(notification)
      notification.show()
    },

    bounceDock() {
      app.dock?.bounce('informational')
    },

    pendingNotifications: () => pending.size
  }
}
