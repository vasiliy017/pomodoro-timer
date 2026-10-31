import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_TIMER_CONFIG } from '@shared/timer'
import { resolveTimerConfig } from './timer-config'

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('resolveTimerConfig', () => {
  it('uses the default when the variable is unset', () => {
    expect(resolveTimerConfig(false, undefined)).toEqual(DEFAULT_TIMER_CONFIG)
  })

  it('merges the test phase lengths over the default in an unpackaged build', () => {
    expect(resolveTimerConfig(false, '{"focusMs":3000,"shortBreakMs":2000}')).toEqual({
      ...DEFAULT_TIMER_CONFIG,
      focusMs: 3000,
      shortBreakMs: 2000
    })
  })

  it('ignores the variable in a packaged build', () => {
    expect(resolveTimerConfig(true, '{"focusMs":3000}')).toEqual(DEFAULT_TIMER_CONFIG)
    expect(console.error).not.toHaveBeenCalled()
  })

  it.each([
    'not json',
    '[1,2]',
    'null',
    '{"focusMs":-1}',
    '{"focusMs":"fast"}',
    '{"focusSessionsPerCycle":1.5}'
  ])('logs and falls back to the default for %s', (raw) => {
    expect(resolveTimerConfig(false, raw)).toEqual(DEFAULT_TIMER_CONFIG)
    expect(console.error).toHaveBeenCalledWith(
      '[timer] ignoring POMODORO_TEST_TIMER_CONFIG',
      expect.anything()
    )
  })

  it('ignores unknown keys', () => {
    expect(resolveTimerConfig(false, '{"focusMs":3000,"turbo":true}')).toEqual({
      ...DEFAULT_TIMER_CONFIG,
      focusMs: 3000
    })
  })
})
