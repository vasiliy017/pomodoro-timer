/**
 * The only place main reads the time for the timer (sad.md §8 *Time*). The rules in
 * `src/shared/timer.ts` never read a clock; the timer service passes these values in, and tests
 * pass a fake `Clock`. Every call reads the zone afresh, so a time-zone change shows on the next call.
 */
export interface Clock {
  /** Wall-clock epoch ms. */
  now(): number
  /** The Mac's local calendar date at `at` (default: now), as `YYYY-MM-DD`. */
  localDate(at?: number): string
  /** Epoch ms of the next local 00:00 after `at` (default: now). Honors 23 h and 25 h days. */
  nextLocalMidnight(at?: number): number
}

export const systemClock: Clock = {
  now: () => Date.now(),

  localDate(at = Date.now()) {
    const date = new Date(at)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${date.getFullYear()}-${month}-${day}`
  },

  nextLocalMidnight(at = Date.now()) {
    const date = new Date(at)
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime()
  }
}
