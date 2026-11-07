import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'

/** test-plan.md: spec §6 launch time is measured over several cold launches. */
const COLD_LAUNCHES = 3

for (let launch = 1; launch <= COLD_LAUNCHES; launch++) {
  test(`cold launch ${launch}: the app boots to focus session 1 of 4, ready at 25:00, through the IPC bridge`, async () => {
    const userData = mkdtempSync(join(tmpdir(), 'pomodoro-e2e-'))
    // Hosts built on Electron (VS Code and its terminals) export ELECTRON_RUN_AS_NODE=1, which would
    // start the app as plain Node.
    const { ELECTRON_RUN_AS_NODE: _runAsNode, ...env } = process.env
    const launchedAt = Date.now()
    const app = await electron.launch({
      args: ['.', `--user-data-dir=${userData}`],
      env: env as Record<string, string>
    })

    try {
      const window = await app.firstWindow()
      await expect(window).toHaveTitle('Pomodoro Timer')
      // The screen shows the snapshot main sent over the bridge (timerGetState / timer:state).
      await expect(window.getByRole('heading', { name: 'Focus session 1 of 4' })).toBeVisible()
      await expect(window.getByRole('timer')).toHaveText('25:00')
      await expect(window.getByRole('button', { name: 'Start', exact: true })).toBeVisible()
      // spec.md §6: a cold launch shows the ready focus session within 2 s.
      const launchMs = Date.now() - launchedAt
      expect(launchMs, `launch took ${launchMs} ms`).toBeLessThanOrEqual(2_000)

      // The page sees only the bridge: no Node globals (nodeIntegration off, sandbox, isolation).
      const pageGlobals = await window.evaluate(() => ({
        api: typeof (globalThis as { api?: unknown }).api,
        require: typeof (globalThis as { require?: unknown }).require,
        process: typeof (globalThis as { process?: unknown }).process
      }))
      expect(pageGlobals).toEqual({ api: 'object', require: 'undefined', process: 'undefined' })
    } finally {
      await app.close()
      rmSync(userData, { recursive: true, force: true })
    }
  })
}
