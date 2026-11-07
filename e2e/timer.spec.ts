import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
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
    body: { textContent: string | null }
    querySelector(selector: string): { textContent: string | null } | null
    querySelectorAll(selector: string): Iterable<{ textContent: string | null; click(): void }>
    elementFromPoint(
      x: number,
      y: number
    ): { closest(selector: string): { textContent: string | null } | null } | null
  }
  performance: { now(): number }
  requestAnimationFrame(callback: () => void): number
  MutationObserver: new (callback: () => void) => {
    observe(target: unknown, options: Record<string, boolean>): void
    disconnect(): void
  }
  phaseEndArrivals?: number[]
}

/** spec.md §6: click → visible change. */
const CONTROL_BUDGET_MS = 100
/** test-plan.md: each control is clicked at least 10 times. */
const CONTROL_ROUNDS = 10
/** spec.md §6: scheduled phase end → on-screen change, window hidden. */
const PHASE_END_BUDGET_MS = 1_000
/** test-plan.md: consecutive phase ends with the window closed. */
const PHASE_ENDS = 5
/** Longer than the command's round trip, shorter than any OS double-click interval. */
const DOUBLE_CLICK_GAP_MS = 150
/** Longer than macOS's key-repeat delay is short: each repeat arrives after the round trip. */
const KEY_REPEAT_GAP_MS = 100
const KEY_REPEATS = 4
/** A losing second instance quits at once; past this it is treated as a hang and killed. */
const SECOND_INSTANCE_TIMEOUT_MS = 10_000

interface Launched {
  app: ElectronApplication
  window: Page
  close(): Promise<void>
}

// Hosts built on Electron export ELECTRON_RUN_AS_NODE=1, which would start the app as plain Node.
const { ELECTRON_RUN_AS_NODE: _runAsNode, ...hostEnv } = process.env

/**
 * Launches the built app with short test phases (sad.md §8 *Test seams*). A `userData` passed in
 * outlives the app, for a test that launches again into the same directory.
 */
async function launch(config: Record<string, number>, userData?: string): Promise<Launched> {
  const dir = userData ?? mkdtempSync(join(tmpdir(), 'pomodoro-e2e-'))
  const app = await electron.launch({
    args: ['.', `--user-data-dir=${dir}`],
    env: { ...hostEnv, POMODORO_TEST_TIMER_CONFIG: JSON.stringify(config) } as Record<
      string,
      string
    >
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
      if (!userData) rmSync(dir, { recursive: true, force: true })
    }
  }
}

/** Launches again outside Playwright: a losing second instance quits before it can be attached. */
function launchSecondInstance(userData: string): Promise<number | null> {
  const electronPath = createRequire(import.meta.url)('electron') as string
  return new Promise((resolve, reject) => {
    const child = spawn(electronPath, ['.', `--user-data-dir=${userData}`], { env: hostEnv })
    // If the single-instance handover breaks, the child opens its own window and never exits.
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(`second instance did not quit within ${SECOND_INSTANCE_TIMEOUT_MS} ms`))
    }, SECOND_INSTANCE_TIMEOUT_MS)
    child.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.once('exit', (code) => {
      clearTimeout(timer)
      resolve(code)
    })
  })
}

/**
 * Clicks a button inside the page and returns the ms until `expected` is on the screen and the next
 * frame is drawn. Measured in the page so Playwright's own actionability checks do not count, and
 * on the command's own change so a countdown tick can't stop the clock early.
 */
async function timeClick(
  window: Page,
  label: string,
  expected: string,
  scope = 'main'
): Promise<number> {
  return window.evaluate(
    ({ label, expected, scope }) =>
      new Promise<number>((resolve, reject) => {
        const page = globalThis as unknown as PageGlobals
        const button = [...page.document.querySelectorAll(`${scope} button`)].find(
          (element) => element.textContent === label
        )
        if (!button) return reject(new Error(`no button «${label}» in ${scope}`))
        const shown = () => page.document.body.textContent?.includes(expected)
        if (shown()) return reject(new Error(`«${expected}» is already on screen`))
        const started = page.performance.now()
        const observer = new page.MutationObserver(() => {
          if (!shown()) return
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
    { label, expected, scope }
  )
}

/**
 * A real double-click: the second press lands where the first did, after the app has reacted.
 * `at` is the press point as a fraction of the button's box. It is chosen so that the control
 * replacing this one sits under the pointer, and the second press is checked to hit a control, so
 * a layout change fails the test instead of letting the second press land on empty space.
 * Returns the label of the control the second press landed on.
 */
async function doubleClick(
  window: Page,
  name: string,
  at = { x: 0.5, y: 0.5 }
): Promise<string | null> {
  const box = await window.getByRole('button', { name, exact: true }).boundingBox()
  if (!box) throw new Error(`no button «${name}»`)
  const x = box.x + box.width * at.x
  const y = box.y + box.height * at.y
  await window.mouse.move(x, y)
  await window.mouse.down({ clickCount: 1 })
  await window.mouse.up({ clickCount: 1 })
  await window.waitForTimeout(DOUBLE_CLICK_GAP_MS)
  const under = await window.evaluate(
    ({ x, y }) =>
      (globalThis as unknown as PageGlobals).document.elementFromPoint(x, y)?.closest('button')
        ?.textContent ?? null,
    { x, y }
  )
  expect(under, `the second press on «${name}» must land on a control`).not.toBeNull()
  await window.mouse.down({ clickCount: 2 })
  await window.mouse.up({ clickCount: 2 })
  await window.waitForTimeout(DOUBLE_CLICK_GAP_MS)
  return under
}

async function revision(window: Page): Promise<number> {
  return window.evaluate(async () => {
    const result = await (globalThis as unknown as PageGlobals).api.timerGetState()
    return result.ok ? result.value.revision : -1
  })
}

test.describe('timer flows', () => {
  test('every control shows its change within 100 ms, ten rounds (spec §6)', async () => {
    test.setTimeout(120_000)
    const { window, close } = await launch({ focusMs: 60_000, shortBreakMs: 60_000 })
    try {
      const steps: [string, string, string?][] = [
        ['Start', 'Running'],
        ['Pause', 'Paused'],
        ['Resume', 'Running'],
        ['Reset', 'Ready'],
        ['Start', 'Running'],
        ['Skip', 'Short break'],
        ['Start', 'Running'],
        // A running break is at stake, so Restart cycle asks first (AC-12).
        ['Restart cycle', 'Restart the cycle?'],
        ['Restart cycle', 'Focus session 1 of 4', 'dialog']
      ]
      for (let round = 1; round <= CONTROL_ROUNDS; round++) {
        for (const [label, expected, scope] of steps) {
          const ms = await timeClick(window, label, expected, scope)
          expect(ms, `round ${round}: ${label} took ${ms.toFixed(1)} ms`).toBeLessThanOrEqual(
            CONTROL_BUDGET_MS
          )
        }
        await expect(window.getByRole('dialog')).toBeHidden()
      }
    } finally {
      await close()
    }
  })

  test('Start counts down from 25:00 on focus session 1 of 4 (AC-01)', async () => {
    const { window, close } = await launch({})
    try {
      await expect(window.getByRole('timer')).toHaveText('25:00')
      await window.getByRole('button', { name: 'Start', exact: true }).click()
      await expect(window.getByRole('heading', { name: 'Focus session 1 of 4' })).toBeVisible()
      await expect(window.getByText('Running')).toBeVisible()
      await expect(window.getByRole('timer')).toHaveText(/^24:5\d$/, { timeout: 3_000 })
    } finally {
      await close()
    }
  })

  test('Cancel keeps the cycle, Confirm restarts it (AC-12)', async () => {
    const { window, close } = await launch({ focusMs: 1_000, shortBreakMs: 60_000 })
    const dialog = window.getByRole('dialog')
    const heading = (name: string) => window.getByRole('heading', { name })
    const restart = () => window.getByRole('button', { name: 'Restart cycle', exact: true }).click()
    try {
      await window.getByRole('button', { name: 'Start', exact: true }).click()
      await expect(heading('Short break')).toBeVisible({ timeout: 5_000 })
      await window.getByRole('button', { name: 'Start', exact: true }).click()
      await expect(window.getByText('Running')).toBeVisible()

      await restart()
      await expect(dialog).toContainText(
        '1 completed focus session will no longer count toward the long break, and the short break in progress will end.'
      )
      await dialog.getByRole('button', { name: 'Cancel' }).click()
      await expect(dialog).toBeHidden()
      await expect(heading('Short break')).toBeVisible()
      await expect(window.getByText('Running')).toBeVisible()
      await expect(window.getByText('1 of 4 completed')).toBeVisible()

      await restart()
      await dialog.getByRole('button', { name: 'Restart cycle' }).click()
      await expect(dialog).toBeHidden()
      await expect(heading('Focus session 1 of 4')).toBeVisible()
      await expect(window.getByText('Ready')).toBeVisible()
      await expect(window.getByRole('timer')).toHaveText('00:01')
    } finally {
      await close()
    }
  })

  test('a double-click on any control has the effect of one click (AC-02)', async () => {
    const { window, close } = await launch({ focusMs: 60_000, shortBreakMs: 60_000 })
    try {
      // Each press point puts the control that replaces this one under the pointer (420×560
      // window): the top of Start lies under the running Pause; Pause and Resume share a slot; the
      // left of a break's Skip lies under the next focus session's Start.
      const steps: [string, { x: number; y: number }, string, () => Promise<void>][] = [
        [
          'Start',
          { x: 0.4, y: 0.2 },
          'Pause',
          () => expect(window.getByText('Running')).toBeVisible()
        ],
        [
          'Pause',
          { x: 0.5, y: 0.5 },
          'Resume',
          () => expect(window.getByText('Paused')).toBeVisible()
        ],
        [
          'Resume',
          { x: 0.5, y: 0.5 },
          'Pause',
          () => expect(window.getByText('Running')).toBeVisible()
        ],
        [
          'Skip',
          { x: 0.2, y: 0.35 },
          'Start',
          async () => {
            await expect(
              window.getByRole('heading', { name: 'Focus session 1 of 4' })
            ).toBeVisible()
            await expect(window.getByText('Ready')).toBeVisible()
          }
        ]
      ]
      for (const [name, at, replacement, check] of steps) {
        if (name === 'Skip') {
          // AC-02's example: Skip on the ready break, and the second press must not start the
          // focus session that replaced it. One plain Skip first moves from running to the break.
          await window.getByRole('button', { name: 'Skip', exact: true }).click()
          await expect(window.getByRole('heading', { name: 'Short break' })).toBeVisible()
        }
        const before = await revision(window)
        expect(await doubleClick(window, name, at), `under the second press on ${name}`).toBe(
          replacement
        )
        await check()
        expect(await revision(window), `double-click on ${name}`).toBe(before + 1)
      }
    } finally {
      await close()
    }
  })

  test('holding Enter on a focused control has the effect of one press (AC-02)', async () => {
    const { window, close } = await launch({ focusMs: 60_000, shortBreakMs: 60_000 })
    try {
      await window.getByRole('button', { name: 'Start', exact: true }).focus()
      const before = await revision(window)
      // The first keydown, then auto-repeats (Playwright marks a keydown on a held key repeat).
      for (let press = 0; press <= KEY_REPEATS; press++) {
        await window.keyboard.down('Enter')
        await window.waitForTimeout(KEY_REPEAT_GAP_MS)
      }
      await window.keyboard.up('Enter')
      await expect(window.getByText('Running')).toBeVisible()
      expect(await revision(window), 'held Enter on Start').toBe(before + 1)
    } finally {
      await close()
    }
  })

  test('five phase ends in a row reach the hidden window within 1 s each, and reopening shows the same window', async () => {
    test.setTimeout(60_000)
    const { app, window, close } = await launch({ focusMs: 3_000, shortBreakMs: 3_000 })
    try {
      await window.evaluate(() => {
        const page = globalThis as unknown as PageGlobals
        page.phaseEndArrivals = []
        page.api.onTimerState((snapshot) => {
          if (snapshot.notice) page.phaseEndArrivals?.push(Date.now())
        })
      })

      // Closing the window only hides it (ADR-0009).
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close())
      expect(
        await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible())
      ).toBe(false)

      for (let end = 1; end <= PHASE_ENDS; end++) {
        // Each next phase waits ready (AC-08), so main gets the Start over the bridge.
        const endsAt = await window.evaluate(async () => {
          const { api } = globalThis as unknown as PageGlobals
          const state = await api.timerGetState()
          if (!state.ok) return null
          const started = await api.timerCommand({ type: 'start', revision: state.value.revision })
          return started.ok ? started.value.snapshot.endsAt : null
        })
        expect(endsAt).not.toBeNull()

        const arrivals = () =>
          window.evaluate(() => (globalThis as unknown as PageGlobals).phaseEndArrivals ?? [])
        await expect.poll(async () => (await arrivals()).length, { timeout: 10_000 }).toBe(end)
        const arrivedAt = (await arrivals()).at(-1) as number
        expect(arrivedAt - (endsAt as number), `phase end ${end}`).toBeLessThanOrEqual(
          PHASE_END_BUDGET_MS
        )
      }

      // The Dock icon reopens the one window, showing the ready break and the notice (AC-06, AC-13).
      await app.evaluate(({ app }) => app.emit('activate'))
      await expect(window.getByRole('heading', { name: 'Short break' })).toBeVisible()
      await expect(window.getByRole('status')).toHaveText('Focus session complete')
      await expect(window.getByText('3 of 4 completed')).toBeVisible()
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

  test('two macOS accounts keep independent timers (AC-03)', async () => {
    const first = await launch({})
    const second = await launch({})
    try {
      await first.window.getByRole('button', { name: 'Start', exact: true }).click()
      await expect(first.window.getByText('Running')).toBeVisible()

      await expect(
        second.window.getByRole('heading', { name: 'Focus session 1 of 4' })
      ).toBeVisible()
      await expect(second.window.getByText('Ready')).toBeVisible()
      await expect(second.window.getByRole('timer')).toHaveText('25:00')
    } finally {
      await second.close()
      await first.close()
    }
  })

  test('a second launch reuses the one window and quits (AC-13)', async () => {
    const userData = mkdtempSync(join(tmpdir(), 'pomodoro-e2e-'))
    const { app, close } = await launch({}, userData)
    const isVisible = () =>
      app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible())
    try {
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close())
      expect(await isVisible()).toBe(false)

      expect(await launchSecondInstance(userData)).toBe(0)

      await expect.poll(isVisible).toBe(true)
      expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(
        1
      )
    } finally {
      await close()
      rmSync(userData, { recursive: true, force: true })
    }
  })

  test('the next launch after a quit starts fresh (AC-13)', async () => {
    const userData = mkdtempSync(join(tmpdir(), 'pomodoro-e2e-'))
    try {
      const before = await launch({ focusMs: 1_000, shortBreakMs: 60_000 }, userData)
      try {
        await before.window.getByRole('button', { name: 'Start', exact: true }).click()
        await expect(before.window.getByText('1 of 4 completed')).toBeVisible({ timeout: 5_000 })
        await before.window.getByRole('button', { name: 'Start', exact: true }).click()
        await expect(before.window.getByText('Running')).toBeVisible()
      } finally {
        await before.close()
      }

      const after = await launch({}, userData)
      try {
        await expect(after.window.getByText('Ready')).toBeVisible()
        await expect(after.window.getByRole('timer')).toHaveText('25:00')
        // The heading launch() waited for says focus session 1 of 4; the state says nothing carried.
        const fresh = await after.window.evaluate(async () => {
          const result = await (globalThis as unknown as PageGlobals).api.timerGetState()
          return result.ok
            ? { completedInCycle: result.value.completedInCycle, revision: result.value.revision }
            : null
        })
        expect(fresh).toEqual({ completedInCycle: 0, revision: 0 })
      } finally {
        await after.close()
      }
    } finally {
      rmSync(userData, { recursive: true, force: true })
    }
  })
})
