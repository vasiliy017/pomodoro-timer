import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createJsonStore, createSettingsStore, type StoreDefinition } from './store'
import { runMigrations, type VersionedDocument } from './store/migrations'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pomodoro-store-'))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('settings store', () => {
  it('creates settings.json with the v1 defaults when the file is missing', () => {
    const store = createSettingsStore(dir)

    expect(store.load()).toEqual({ schemaVersion: 1 })
    expect(JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf8'))).toEqual({
      schemaVersion: 1
    })
  })

  it('loads an existing v1 file as is', () => {
    writeFileSync(join(dir, 'settings.json'), JSON.stringify({ schemaVersion: 1, extra: true }))

    expect(createSettingsStore(dir).load()).toEqual({ schemaVersion: 1, extra: true })
  })

  it('moves a corrupt file aside and starts from the defaults', () => {
    writeFileSync(join(dir, 'settings.json'), '{ not json')

    expect(createSettingsStore(dir).load()).toEqual({ schemaVersion: 1 })
    const aside = readdirSync(dir).filter((name) => name.startsWith('settings.json.corrupt-'))
    expect(aside).toHaveLength(1)
    expect(readFileSync(join(dir, aside[0]!), 'utf8')).toBe('{ not json')
  })

  it('writes atomically and leaves no temp file behind', () => {
    const store = createSettingsStore(dir)
    store.save({ schemaVersion: 1 })

    expect(readdirSync(dir)).toEqual(['settings.json'])
  })
})

describe('migration chain', () => {
  interface V2 extends VersionedDocument {
    schemaVersion: 2
    name: string
  }

  const definition: StoreDefinition<V2> = {
    fileName: 'thing.json',
    schemaVersion: 2,
    defaults: () => ({ schemaVersion: 2, name: 'default' }),
    migrations: { 1: (doc) => ({ ...doc, schemaVersion: 2, name: 'migrated' }) }
  }

  it('upgrades an older file on load and persists the upgrade', () => {
    writeFileSync(join(dir, 'thing.json'), JSON.stringify({ schemaVersion: 1 }))

    expect(createJsonStore(dir, definition).load()).toEqual({ schemaVersion: 2, name: 'migrated' })
    expect(JSON.parse(readFileSync(join(dir, 'thing.json'), 'utf8')).schemaVersion).toBe(2)
  })

  it('reports a gap in the chain instead of throwing', () => {
    expect(runMigrations({ schemaVersion: 1 }, {}, 3)).toEqual({
      ok: false,
      error: 'no migration from schemaVersion 1'
    })
  })

  it('refuses a file written by a newer app version and keeps it aside', () => {
    writeFileSync(join(dir, 'thing.json'), JSON.stringify({ schemaVersion: 9 }))

    expect(createJsonStore(dir, definition).load()).toEqual(definition.defaults())
    expect(existsSync(join(dir, 'thing.json'))).toBe(true)
    expect(readdirSync(dir).some((name) => name.startsWith('thing.json.corrupt-'))).toBe(true)
  })
})
