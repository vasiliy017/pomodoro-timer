import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'

test('the app boots, opens its main window and reaches main over IPC', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'pomodoro-e2e-'))
  // Hosts built on Electron (VS Code and its terminals) export ELECTRON_RUN_AS_NODE=1, which would
  // start the app as plain Node.
  const { ELECTRON_RUN_AS_NODE: _runAsNode, ...env } = process.env
  const app = await electron.launch({
    args: ['.', `--user-data-dir=${userData}`],
    env: env as Record<string, string>
  })

  try {
    const window = await app.firstWindow()
    await expect(window).toHaveTitle('Pomodoro Timer')
    await expect(window.getByRole('heading', { name: 'Pomodoro Timer' })).toBeVisible()
    await expect(window.getByTestId('bridge-status')).toHaveText('pong: renderer')

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
