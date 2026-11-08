import type { ComponentPropsWithRef, KeyboardEvent } from 'react'
import styles from './Button.module.css'

interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: 'primary' | 'secondary'
}

/**
 * A held Enter auto-repeats keydown, and each repeat clicks the focused button again — on a
 * timer control at the new revision, or on whatever button took focus after the first press,
 * such as a dialog's Cancel (AC-02). Only the first press counts; Space is covered too.
 */
function isHeldKey(event: KeyboardEvent) {
  return event.repeat && (event.key === 'Enter' || event.key === ' ')
}

/** The app's button. Primary for the one main action on a screen, secondary for the rest. */
export function Button({
  variant = 'secondary',
  className,
  type = 'button',
  onKeyDown,
  ...props
}: ButtonProps) {
  const classes = [styles.button, styles[variant], className].filter(Boolean).join(' ')
  return (
    <button
      type={type}
      className={classes}
      onKeyDown={(event) => {
        if (isHeldKey(event)) event.preventDefault()
        onKeyDown?.(event)
      }}
      {...props}
    />
  )
}
