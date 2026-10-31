---
status: Accepted
owner: "Vasiliy"
reviewers: []
updated_at: "2026-10-31"
feature_size: ""
ticket: ""
---

# 0003 — Persist settings and session history as versioned local JSON files

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Vasiliy (owner), with Claude during the greenfield `survey` session

## Context

v1 stores user settings (durations, sounds) and a local session history for statistics. There is
no sync and no account (idea-brief §5). The volume is tiny: a handful of sessions per day.

## Decision drivers

- Local-only data with no sync (idea-brief §5).
- Tiny data volume and simple queries (counts per day/week).
- Avoid native modules, which complicate Electron packaging and upgrades.

## Considered options

1. **Versioned JSON files** in `userData` (`settings.json`, `history.json`), owned by one store
   module in main, with atomic writes and `schemaVersion` migrations.
2. **SQLite** (e.g. better-sqlite3). Real queries, but it is a native module that must be rebuilt
   for each Electron version.

## Decision outcome

**Chosen:** versioned JSON files. They fit the data size and need no native dependencies. Main
writes them atomically (temp file, then rename) and upgrades them with pure, tested migration
functions on load.

## Consequences

**Positive**
- Zero native dependencies, and packaging stays simple.
- The files are human-readable, which makes debugging and user backups easy.

**Negative**
- Statistics are computed in memory by reading the whole history file. That is fine for years of
  sessions, but not for analytics-scale data.
- The schema migrations are hand-written, with no external tool.

**Neutral**
- Moving to SQLite later means a one-time import from `history.json`.

## Links

- Idea brief: [[../idea-brief.md]] §5, §7
- Architecture map: [[../architecture-map.md]] §Datastores, §Conventions
- Related ADR: [[0002-run-the-timer-engine-in-the-main-process]]
