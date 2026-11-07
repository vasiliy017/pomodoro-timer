import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page
} from '@playwright/test'
import type { Api } from '../src/shared/ipc'

/**
 * The page globals these tests touch. The e2e project has no DOM lib (it type-checks with main),
 * so callbacks that run in the page reach them through this view of `globalThis`.
 */
interface PageGlobals {
  api: Api
  document: {
    body: { innerText: string }
    querySelector(selector: string): { textContent: string | null } | null
    querySelectorAll(selector: string): Iterable<{ textContent: string | null; click(): void }>
  }
  performance: { now(): number }
  requestAnimationFrame(callback: () => void): number
  MutationObserver: new (callback: () => void) => {
    observe(target: unknown, options: Record<string, boolean>): void
    disconnect(): void
  }
  phaseEndArrivedAt?: number
}

/** spec.md §6: click → visible change. */
const CONTROL_BUDGET_MS = 100
/** spec.md §6: scheduled phase end → on-screen change, window hidden. */
const PHASE_END_BUDGET_MS = 1_000
/** Longer than the command's round trip, shorter than any OS double-click interval. */
const DOUBLE_CLICK_GAP_MS = 150

interface Launched {
  app: ElectronApplication
  window: Page
  close(): Promise<void>
}

/** Launches the built app with short test phases (sad.md §8 *Test seams*). */
async function launch(config: Record<string, number>): Promise<Launched> {
  const userData = mkdtempSync(join(tmpdir(), 'pomodoro-e2e-'))
  // Hosts built on Electron export ELECTRON_RUN_AS_NODE=1, which would start the app as plain Node.
  const { ELECTRON_RUN_AS_NODE: _runAsNode, ...env } = process.env
  const app = await electron.launch({
    args: ['.', `--user-data-dir=${userData}`],
    env: { ...env, POMODORO_TEST_TIMER_CONFIG: JSON.stringify(config) } as Record<string, string>
  })
  const window = await app.firstWindow()
  await expect(window.getByRole('heading', { name: 'Focus session 1 of 4' })).toBeVisible()

  return {
    app,
    window,
    async close() {
      // A quit with progress at stake asks first (AC-13): answer Quit so teardown never hangs.
      await app.evaluate(({ dialog }) => {
        dialog.showMessageBox = (async () => ({ response: 0, checkboxChecked: false })) as never
      })
      await app.close()
      rmSync(userData, { recursive: true, force: true })
    }
  }
}

/**
 * Clicks a button inside the page and returns the ms until the screen's text changes and the next
 * frame is drawn. Measured in the page so Playwright's own actionability checks do not count.
 */
async function timeClick(window: Page, label: string, scope = 'main'): Promise<number> {
  return window.evaluate(
    ({ label, scope }) =>
      new Promise<number>((resolve, reject) => {
        const page = globalThis as unknown as PageGlobals
        const button = [...page.document.querySelectorAll(`${scope} button`)].find(
          (element) => element.textContent === label
        )
        if (!button) return reject(new Error(`no button «${label}» in ${scope}`))
        const before = page.document.body.innerText
        const started = page.performance.now()
        const observer = new page.MutationObserver(() => {
          if (page.document.body.innerText === before) return
          observer.disconnect()
          page.requestAnimationFrame(() => resolve(page.performance.now() - started))
        })
        observer.observe(page.document.body, {
          subtree: true,
          childList: true,
          characterData: true,
          attributes: true
        })
        button.click()
      }),
    { label, scope }
  )
}

/** A real double-click: the second press lands where the first did, after the app has reacted. */
async function doubleClick(window: Page, name: string): Promise<void> {
  const box = await window.getByRole('button', { name, exact: true }).boundingBox()
  if (!box) throw new Error(`no button «${name}»`)
  await window.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await window.mouse.down({ clickCount: 1 })
  await window.mouse.up({ clickCount: 1 })
  await window.waitForTimeout(DOUBLE_CLICK_GAP_MS)
  await window.mouse.down({ clickCount: 2 })
  await window.mouse.up({ clickCount: 2 })
  await window.waitForTimeout(DOUBLE_CLICK_GAP_MS)
}

async function revision(window: Page): Promise<number> {
  return window.evaluate(async () => {
    const result = await (globalThis as unknown as PageGlobals).api.timerGetState()
    return result.ok ? result.value.revision : -1
  })
}

test.describe('timer flows', () => {
  test('every control shows its change within 100 ms (spec §6)', async () => {
    const { window, close } = await launch({ focusMs: 60_000, shortBreakMs: 60_000 })
    const timer = window.getByRole('timer')
    try {
      const steps: [string, () => Promise<void>, string?][] = [
        ['Start', () => expect(window.getByText('Running')).toBeVisible()],
        ['Pause', () => expect(window.getByText('Paused')).toBeVisible()],
        ['Resume', () => expect(window.getByText('Running')).toBeVisible()],
        ['Reset', () => expect(timer).toHaveText('01:00')],
        ['Start', () => expect(window.getByText('Running')).toBeVisible()],
        ['Skip', () => expect(window.getByRole('heading', { name: 'Short break' })).toBeVisible()],
        ['Start', () => expect(window.getByText('Running')).toBeVisible()],
        // A running break is at stake, so Restart cycle asks first (AC-12).
        ['Restart cycle', () => expect(window.getByRole('dialog')).toBeVisible()],
        [
          'Restart cycle',
          () => expect(window.getByRole('heading', { name: 'Focus session 1 of 4' })).toBeVisible(),
          'dialog'
        ]
      ]
      for (const [label, check, scope] of steps) {
        const ms = await timeClick(window, label, scope)
        await check()
        expect(ms, `${label} took ${ms.toFixed(1)} ms`).toBeLessThanOrEqual(CONTROL_BUDGET_MS)
      }
      await expect(window.getByRole('dialog')).toBeHidden()
    } finally {
      await close()
    }
  })

  test('a double-click on any control has the effect of one click (AC-02)', async () => {
    const { window, close } = await launch({ focusMs: 60_000, shortBreakMs: 60_000 })
    try {
      const steps: [string, () => Promise<void>][] = [
        ['Start', () => expect(window.getByText('Running')).toBeVisible()],
        ['Pause', () => expect(window.getByText('Paused')).toBeVisible()],
        ['Resume', () => expect(window.getByText('Running')).toBeVisible()],
        ['Skip', () => expect(window.getByRole('heading', { name: 'Short break' })).toBeVisible()]
      ]
      for (const [name, check] of steps) {
        const before = await revision(window)
        await doubleClick(window, name)
        await check()
        expect(await revision(window), `double-click on ${name}`).toBe(before + 1)
      }
    } finally {
      await close()
    }
  })

  test('a phase end reaches the hidden window within 1 s, and reopening shows the same window', async () => {
    const { app, window, close } = await launch({ focusMs: 3_000, shortBreakMs: 2_000 })
    try {
      await window.evaluate(() => {
        const page = globalThis as unknown as PageGlobals
        page.api.onTimerState((snapshot) => {
          if (snapshot.phase === 'shortBreak') page.phaseEndArrivedAt ??= Date.now()
        })
      })
      await window.getByRole('button', { name: 'Start', exact: true }).click()
      const endsAt = await window.evaluate(async () => {
        const result = await (globalThis as unknown as PageGlobals).api.timerGetState()
        return result.ok ? result.value.endsAt : null
      })
      expect(endsAt).not.toBeNull()

      // Closing the window only hides it (ADR-0009).
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close())
      expect(
        await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible())
      ).toBe(false)

      await expect
        .poll(
          () => window.evaluate(() => (globalThis as unknown as PageGlobals).phaseEndArrivedAt),
          {
            timeout: 10_000
          }
        )
        .toBeDefined()
      const arrivedAt = await window.evaluate(
        () => (globalThis as unknown as PageGlobals).phaseEndArrivedAt as number
      )
      expect(arrivedAt - (endsAt as number)).toBeLessThanOrEqual(PHASE_END_BUDGET_MS)

      // The Dock icon reopens the one window, showing the ready break and the notice (AC-06, AC-13).
      await app.evaluate(({ app }) => app.emit('activate'))
      await expect(window.getByRole('heading', { name: 'Short break' })).toBeVisible()
      await expect(window.getByRole('status')).toHaveText('Focus session complete')
      await expect(window.getByText('1 of 4 completed')).toBeVisible()
      expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(
        1
      )
    } finally {
      await close()
    }
  })

  test('a reopened window shows the current remaining time at once, not an older value (AC-13)', async () => {
    const { app, window, close } = await launch({ focusMs: 60_000 })
    try {
      await window.getByRole('button', { name: 'Start', exact: true }).click()
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close())
      await window.waitForTimeout(3_000)
      await app.evaluate(({ app }) => app.emit('activate'))
      const shown = await window.evaluate(async () => {
        const page = globalThis as unknown as PageGlobals
        const result = await page.api.timerGetState()
        const snapshot = result.ok ? result.value : null
        return {
          text: page.document.querySelector('[role=timer]')?.textContent,
          expected: snapshot?.endsAt ? Math.ceil((snapshot.endsAt - Date.now()) / 1000) : null
        }
      })
      const [mm, ss] = (shown.text ?? '').split(':').map(Number)
      const seconds = (mm ?? 0) * 60 + (ss ?? 0)
      expect(seconds).toBeLessThanOrEqual(57)
      expect(Math.abs(seconds - (shown.expected ?? 0))).toBeLessThanOrEqual(1)
    } finally {
      await close()
    }
  })
})
