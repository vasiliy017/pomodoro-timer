import { Panel } from './components/ui/Panel'
import { TimerScreen } from './screens/TimerScreen'
import styles from './App.module.css'

export function App() {
  return (
    <main className={styles.app}>
      <Panel>
        <TimerScreen />
      </Panel>
    </main>
  )
}
