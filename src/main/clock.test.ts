import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { systemClock } from './clock'

const HOUR = 3_600_000
let originalTz: string | undefined

beforeEach(() => {
  originalTz = process.env['TZ']
})

afterEach(() => {
  if (originalTz === undefined) delete process.env['TZ']
  else process.env['TZ'] = originalTz
})

describe('systemClock', () => {
  it('now() is the wall-clock epoch ms', () => {
    const before = Date.now()
    const now = systemClock.now()
    expect(now).toBeGreaterThanOrEqual(before)
    expect(now).toBeLessThanOrEqual(Date.now())
  })

  describe('in Europe/Kyiv', () => {
    beforeEach(() => {
      process.env['TZ'] = 'Europe/Kyiv'
    })

    it('localDate is the local calendar date, not the UTC one', () => {
      // 2026-10-31 23:30 UTC is already 2026-11-01 01:30 in Kyiv (UTC+2 after the DST end).
      expect(systemClock.localDate(Date.UTC(2026, 9, 31, 23, 30))).toBe('2026-11-01')
      expect(systemClock.localDate(Date.UTC(2026, 9, 31, 21, 30))).toBe('2026-10-31')
    })

    it('at 23:59:59.999 local it is still today and midnight is 1 ms away', () => {
      const lastMs = Date.UTC(2026, 9, 31, 21, 59, 59, 999) // 23:59:59.999 in Kyiv
      expect(systemClock.localDate(lastMs)).toBe('2026-10-31')
      expect(systemClock.nextLocalMidnight(lastMs)).toBe(lastMs + 1)
      expect(systemClock.localDate(lastMs + 1)).toBe('2026-11-01')
    })

    it('on the spring-forward day the next midnight is 23 h after the last one', () => {
      // 2026-03-29: Kyiv moves from UTC+2 to UTC+3 at 03:00.
      const noon = Date.UTC(2026, 2, 29, 9, 0) // 12:00 EEST
      const midnight = systemClock.nextLocalMidnight(noon)
      expect(midnight).toBe(Date.UTC(2026, 2, 29, 21, 0)) // 2026-03-30 00:00 EEST
      expect(midnight - systemClock.nextLocalMidnight(Date.UTC(2026, 2, 28, 9, 0))).toBe(23 * HOUR)
      expect(systemClock.localDate(midnight)).toBe('2026-03-30')
    })
  })

  describe('in America/New_York', () => {
    beforeEach(() => {
      process.env['TZ'] = 'America/New_York'
    })

    it('on the fall-back day the next midnight is 25 h after the last one', () => {
      // 2026-11-01: New York moves from UTC-4 to UTC-5 at 02:00.
      const noon = Date.UTC(2026, 10, 1, 17, 0) // 12:00 EST
      const midnight = systemClock.nextLocalMidnight(noon)
      expect(midnight).toBe(Date.UTC(2026, 10, 2, 5, 0)) // 2026-11-02 00:00 EST
      expect(midnight - systemClock.nextLocalMidnight(Date.UTC(2026, 9, 31, 16, 0))).toBe(25 * HOUR)
    })

    it('localDate lags the UTC date in the evening', () => {
      expect(systemClock.localDate(Date.UTC(2026, 9, 31, 2, 0))).toBe('2026-10-30')
    })
  })

  it('reflects a time-zone change on the next call (no cached offset)', () => {
    const at = Date.UTC(2026, 9, 31, 23, 30)
    process.env['TZ'] = 'America/New_York'
    expect(systemClock.localDate(at)).toBe('2026-10-31')
    process.env['TZ'] = 'Europe/Kyiv'
    expect(systemClock.localDate(at)).toBe('2026-11-01')
  })

  it('defaults to the current instant', () => {
    process.env['TZ'] = 'Europe/Kyiv'
    expect(systemClock.localDate()).toBe(systemClock.localDate(Date.now()))
    expect(systemClock.nextLocalMidnight()).toBeGreaterThan(Date.now())
  })
})
