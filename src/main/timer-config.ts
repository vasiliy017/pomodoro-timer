import { DEFAULT_TIMER_CONFIG, type TimerConfig } from '@shared/timer'

const KEYS = Object.keys(DEFAULT_TIMER_CONFIG) as (keyof TimerConfig)[]

function isPositiveNumber(value: unknown, key: keyof TimerConfig): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return false
  return key !== 'focusSessionsPerCycle' || Number.isInteger(value)
}

/**
 * The timer config main runs with (sad.md §8 *Test seams*). An unpackaged build (`npm run dev`,
 * the Playwright run of `out/`) may shorten the phases through `POMODORO_TEST_TIMER_CONFIG`, a
 * JSON object of phase lengths in ms; the packaged app always uses the default.
 */
export function resolveTimerConfig(isPackaged: boolean, raw: string | undefined): TimerConfig {
  if (isPackaged || raw === undefined) return DEFAULT_TIMER_CONFIG
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('not a JSON object')
    }
    const config = { ...DEFAULT_TIMER_CONFIG }
    for (const key of KEYS) {
      if (!(key in parsed)) continue
      const value = (parsed as Record<string, unknown>)[key]
      if (!isPositiveNumber(value, key)) throw new Error(`${key} must be a positive number`)
      config[key] = value
    }
    return config
  } catch (error) {
    console.error('[timer] ignoring POMODORO_TEST_TIMER_CONFIG', error)
    return DEFAULT_TIMER_CONFIG
  }
}
