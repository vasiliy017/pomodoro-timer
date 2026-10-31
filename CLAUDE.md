# Pomodoro Timer

A free, open-source macOS Pomodoro timer whose session end and break feel like a calm ritual.
Electron + React + TypeScript. Architecture and conventions: `docs/architecture-map.md`; decisions:
`docs/adr/`; plan: `docs/roadmap.md`.

## Commands

- `npm run dev` — run the app with hot reload
- `npm run build` — bundle main, preload and renderer into `out/`
- `npm test` — Vitest unit tests (node project for `src/shared` + `src/main`, jsdom project for the renderer)
- `npm run test:e2e` — build, then the Playwright `_electron` boot smoke test in `e2e/`
- `npm run lint` · `npm run typecheck` (`tsc --noEmit`, node + web configs) · `npm run format`
- `npm run dist:mac` — unsigned macOS `.dmg` into `dist/`

Inside VS Code (or any Electron-based host) `ELECTRON_RUN_AS_NODE=1` may be set in the shell; unset
it before launching the app by hand. The e2e test strips it itself.

## Process boundary

- `src/shared/` — pure TypeScript: no Electron, DOM, React or `node:` imports (enforced by ESLint).
- `src/main/` — owns the timer, windows, notifications and persistence.
- `src/preload/` — builds `window.api` from the IPC contract; no business logic. Emitted as
  CommonJS (`index.cjs`) because the renderer is sandboxed.
- `src/renderer/` — React UI; `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
  Reaches the system only through `window.api`.

## Timer truth

The timer state lives in main (ADR-0002). Remaining time is derived from stored timestamps
(`startedAt`, `pausedAt`, duration), never from counting ticks. The rules live in
`src/shared/timer.ts` (created by the Focus timer core step), unit-tested with fake timers; the
renderer only displays the state main broadcasts on `timer:state`.

## IPC contract

- Every renderer → main call is declared once in `InvokeContract` in `src/shared/ipc.ts`, with its
  channel in `invokeChannels`. Never hand-write a channel string anywhere else.
- Main registers handlers only in `src/main/ipc.ts`. Handlers return values; the registrar wraps
  them in `Result` (`src/shared/result.ts`) and turns unexpected throws into `{ ok: false, error }`
  after logging.
- Add the method to the `api` object in `src/preload/index.ts`; `Api` keeps it type-checked.
- `src/shared` domain functions return results for expected failures instead of throwing.

## Store and migrations (ADR-0003)

- JSON files in `app.getPath('userData')`, accessed only through `src/main/store.ts`.
- Writes are atomic (temp file + rename). Unreadable files are moved aside as
  `<file>.corrupt-<ms>` and replaced by defaults — never silently overwritten.
- Every file carries `schemaVersion`. A schema change bumps it and adds a pure
  `migrate_vN_to_vN+1` to the chain in `src/main/store/migrations.ts`, with a test. Migrations are
  forward-only.
- Session-history IDs: `crypto.randomUUID()`; order by `startedAt`.

## UI, tokens and styling

- Raw values live only in `src/renderer/src/styles/tokens.css` (color light + dark, spacing,
  radius, typography, motion). Components use the custom properties.
- CSS Modules (`*.module.css`) next to each component — no Tailwind, no CSS-in-JS, no third-party
  component kit.
- Shared primitives go in `src/renderer/src/components/ui/`; screens in `src/renderer/src/screens/`.
- Animation uses Motion (`motion/react`). Every animation honors `prefers-reduced-motion`
  (`useReducedMotion()`; the motion tokens drop to 0ms).

## Tests

Vitest, `*.test.ts(x)` next to the subject. Renderer components use Testing Library on jsdom.
Store tests use a real temp directory.
