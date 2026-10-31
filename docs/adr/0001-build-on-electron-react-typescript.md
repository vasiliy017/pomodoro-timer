---
status: Accepted
owner: "Vasiliy"
reviewers: []
updated_at: "2026-10-31"
feature_size: ""
ticket: ""
---

# 0001 — Build the desktop app on Electron with React and TypeScript

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Vasiliy (owner), with Claude during the greenfield `survey` session

## Context

The project is a free, open-source Pomodoro timer for macOS. It sets itself apart through a pleasant
palette and smooth, fitting animations at session end and during the break
([idea-brief](../idea-brief.md) §2, §7). The repository is empty, and the stack has to be fixed
before the skeleton is scaffolded. The owner named TypeScript, React and Electron as the possible
stack in the raw idea.

## Decision drivers

- Animation quality and visual control are the product's purpose (idea-brief §2).
- The app needs a menu-bar icon, native notifications, and its own window that can appear over
  other work at session end (idea-brief §7).
- The owner's stated preference is TypeScript, React and Electron (idea-brief §1).
- macOS comes first, with Windows and Linux deferred but not rejected (idea-brief §5).

## Considered options

1. **Electron + React + TypeScript**: Chromium bundled with the app, Node main process, React UI.
2. **Tauri + React + TypeScript**: system WebView (WebKit on macOS), Rust core. Pomotroid is built
   this way.

## Decision outcome

**Chosen:** Electron + React + TypeScript. It matches the owner's stated preference, and the bundled
Chromium renders animations identically on every machine. It also keeps the whole codebase in one
language. The tray, notification and window APIs cover the v1 needs. Build tooling: electron-vite;
packaging: electron-builder (unsigned `.dmg` for v1).

## Consequences

**Positive**
- One language (TypeScript) across main, preload and UI, and the shared domain code is reused by both.
- Rendering is predictable for animation work, because it does not depend on the macOS WebKit
  version.
- Cross-platform builds stay possible later without a rewrite.

**Negative**
- The installer is large and memory use is high compared to Tauri. Every Electron app bundles its
  own Chromium.
- Electron has frequent major releases, so security updates need regular upgrades.

**Neutral**
- The v1 `.dmg` is unsigned, so users must use Open Anyway (idea-brief §6). Signing can be added
  later in electron-builder config without code changes.

## Links

- Idea brief: [[../idea-brief.md]] §1, §5, §7
- Architecture map: [[../architecture-map.md]] §Stack
- Related ADR: [[0002-run-the-timer-engine-in-the-main-process]]
