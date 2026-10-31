import { useEffect, useState } from 'react'
import { Panel } from './components/ui/Panel'
import styles from './App.module.css'

export function App() {
  const [bridge, setBridge] = useState('connecting…')

  useEffect(() => {
    void window.api.ping('renderer').then((result) => {
      setBridge(result.ok ? result.value : `error: ${result.error}`)
    })
  }, [])

  return (
    <main className={styles.app}>
      <Panel>
        <h1 className={styles.title}>Pomodoro Timer</h1>
        <p className={styles.status} data-testid="bridge-status">
          {bridge}
        </p>
      </Panel>
    </main>
  )
}
