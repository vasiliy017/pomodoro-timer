import { useEffect, useId, useRef, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Button } from './Button'
import styles from './Dialog.module.css'

interface DialogProps {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  cancelLabel?: string
  onConfirm(): void
  /** The Cancel button or Esc. */
  onCancel(): void
}

/**
 * A modal confirmation on the native `<dialog>`: the browser traps focus and turns Esc into a
 * cancel. Cancel takes focus first, so Return never confirms by accident.
 */
export function Dialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const bodyId = useId()
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      cancelRef.current?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onCancel={(event) => {
        // React owns `open`: Esc asks the parent to close instead of closing behind its back.
        event.preventDefault()
        onCancel()
      }}
    >
      {open && (
        <motion.div
          className={styles.content}
          initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <div id={bodyId} className={styles.body}>
            {children}
          </div>
          <div className={styles.actions}>
            <Button ref={cancelRef} onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button variant="primary" onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </motion.div>
      )}
    </dialog>
  )
}
