import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import styles from './Panel.module.css'

interface PanelProps {
  children: ReactNode
}

/** A surface that settles into place. With reduced motion it simply appears. */
export function Panel({ children }: PanelProps) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.section
      className={styles.panel}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.section>
  )
}
