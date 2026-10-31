import { describe, expect, it } from 'vitest'
import { err, ok } from './result'

describe('result', () => {
  it('wraps a success value', () => {
    expect(ok(3)).toEqual({ ok: true, value: 3 })
  })

  it('wraps an expected failure without throwing', () => {
    expect(err('nope')).toEqual({ ok: false, error: 'nope' })
  })
})
