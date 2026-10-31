import { powerMonitor as electronPowerMonitor, systemPreferences as electronPrefs } from 'electron'

export interface SystemEventHandlers {
  onSleep(): void
  onWake(): void
  /** macOS is quitting the app for logout, restart or shutdown (sad.md §6 Flow 8). */
  onShutdown(): void
  onClockChanged(): void
}

type NotificationPrefs = Pick<
  Electron.SystemPreferences,
  | 'subscribeLocalNotification'
  | 'unsubscribeLocalNotification'
  | 'subscribeNotification'
  | 'unsubscribeNotification'
>

export interface SystemEventSources {
  powerMonitor: Pick<NodeJS.EventEmitter, 'on' | 'removeListener'>
  /** The macOS notification API; methods may be missing off macOS. */
  systemPreferences: Partial<NotificationPrefs>
}

const CLOCK_CHANGED = 'NSSystemClockDidChangeNotification'
const TIME_ZONE_CHANGED = 'NSSystemTimeZoneDidChangeDistributedNotification'

/**
 * Maps system sleep, wake, shutdown and clock / time-zone changes to the timer service's
 * callbacks (ADR-0005). Only system sleep counts: screen lock and display sleep are not mapped
 * (AC-14). Returns the unsubscribe function.
 */
export function subscribeSystemEvents(
  handlers: SystemEventHandlers,
  sources: SystemEventSources = {
    powerMonitor: electronPowerMonitor,
    systemPreferences: electronPrefs
  }
): () => void {
  const { powerMonitor, systemPreferences: prefs } = sources
  const power: [string, () => void][] = [
    ['suspend', () => handlers.onSleep()],
    ['resume', () => handlers.onWake()],
    ['shutdown', () => handlers.onShutdown()]
  ]
  for (const [event, listener] of power) powerMonitor.on(event, listener)

  const onClockChanged = () => handlers.onClockChanged()
  const localId = prefs.subscribeLocalNotification?.(CLOCK_CHANGED, onClockChanged)
  const distributedId = prefs.subscribeNotification?.(TIME_ZONE_CHANGED, onClockChanged)

  return () => {
    for (const [event, listener] of power) powerMonitor.removeListener(event, listener)
    if (localId !== undefined) prefs.unsubscribeLocalNotification?.(localId)
    if (distributedId !== undefined) prefs.unsubscribeNotification?.(distributedId)
  }
}
