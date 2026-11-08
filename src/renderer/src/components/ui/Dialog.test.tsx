import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Dialog } from './Dialog'

function renderDialog(open = true) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  const view = render(
    <Dialog
      open={open}
      title="Restart the cycle?"
      confirmLabel="Restart cycle"
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      Something will be lost.
    </Dialog>
  )
  return { ...view, onConfirm, onCancel }
}

describe('Dialog', () => {
  it('opens as a modal named by its title, with its body', () => {
    renderDialog()
    const dialog = screen.getByRole('dialog', { name: 'Restart the cycle?' })
    expect(dialog).toHaveProperty('open', true)
    expect(dialog).toHaveTextContent('Something will be lost.')
  })

  it('is described by its body, so a screen reader announces the sentence with the title', () => {
    renderDialog()
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription('Something will be lost.')
  })

  it('renders nothing visible while closed', () => {
    renderDialog(false)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('confirm and cancel buttons call their handlers', () => {
    const { onConfirm, onCancel } = renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Restart cycle' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('Esc (the native cancel event) cancels without closing behind React', () => {
    const { onCancel } = renderDialog()
    const dialog = screen.getByRole('dialog')
    const event = new Event('cancel', { cancelable: true })
    dialog.dispatchEvent(event)
    expect(onCancel).toHaveBeenCalledOnce()
    expect(event.defaultPrevented).toBe(true)
  })

  it('focuses Cancel first, the safe choice', () => {
    renderDialog()
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  // Holding Enter on Restart cycle opens the dialog with focus on Cancel; the key's auto-repeat
  // must not then click Cancel (AC-02: a held press has the effect of one press).
  it('ignores an auto-repeated Enter or Space on its buttons', () => {
    renderDialog()
    for (const name of ['Cancel', 'Restart cycle']) {
      for (const key of ['Enter', ' ']) {
        const button = screen.getByRole('button', { name })
        expect(fireEvent.keyDown(button, { key, repeat: true }), `${key} on ${name}`).toBe(false)
      }
    }
  })

  it('closes when open turns false', () => {
    const { rerender, onConfirm, onCancel } = renderDialog()
    rerender(
      <Dialog
        open={false}
        title="Restart the cycle?"
        confirmLabel="Restart cycle"
        onConfirm={onConfirm}
        onCancel={onCancel}
      >
        Something will be lost.
      </Dialog>
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
