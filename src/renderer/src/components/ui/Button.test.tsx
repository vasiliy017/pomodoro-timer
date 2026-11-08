import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  // A held key auto-repeats keydown, and each Enter repeat clicks the focused button again (AC-02).
  it.each(['Enter', ' '])('drops auto-repeated %j keydowns and keeps the first press', (key) => {
    render(<Button>Go</Button>)
    const button = screen.getByRole('button', { name: 'Go' })
    // fireEvent returns false when a handler called preventDefault.
    expect(fireEvent.keyDown(button, { key, repeat: true })).toBe(false)
    expect(fireEvent.keyDown(button, { key, repeat: false })).toBe(true)
  })

  it('leaves auto-repeat of other keys alone', () => {
    render(<Button>Go</Button>)
    expect(fireEvent.keyDown(screen.getByRole('button'), { key: 'Tab', repeat: true })).toBe(true)
  })

  it("still calls the caller's onKeyDown", () => {
    const onKeyDown = vi.fn()
    render(<Button onKeyDown={onKeyDown}>Go</Button>)
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter', repeat: true })
    expect(onKeyDown).toHaveBeenCalledOnce()
  })
})
