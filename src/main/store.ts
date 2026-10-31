import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  runMigrations,
  settingsMigrations,
  type MigrationChain,
  type VersionedDocument
} from './store/migrations'

export interface StoreDefinition<T extends VersionedDocument> {
  fileName: string
  schemaVersion: T['schemaVersion']
  defaults: () => T
  migrations: MigrationChain
}

export interface JsonStore<T> {
  readonly path: string
  /** Reads the file, upgrading it if needed. A missing or unreadable file yields the defaults. */
  load(): T
  /** Writes atomically: a temp file in the same directory, then a rename over the target. */
  save(data: T): void
}

function isVersionedDocument(value: unknown): value is VersionedDocument {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Number.isInteger((value as { schemaVersion?: unknown }).schemaVersion)
  )
}

export function createJsonStore<T extends VersionedDocument>(
  dir: string,
  definition: StoreDefinition<T>
): JsonStore<T> {
  const path = join(dir, definition.fileName)

  function save(data: T): void {
    mkdirSync(dir, { recursive: true })
    const tempPath = `${path}.${process.pid}.tmp`
    writeFileSync(tempPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
    renameSync(tempPath, path)
  }

  /** Moves an unusable file aside so the user's data is never silently overwritten. */
  function quarantine(reason: string): T {
    const asidePath = `${path}.corrupt-${Date.now()}`
    console.error(`[store] ${definition.fileName}: ${reason}; moved to ${asidePath}`)
    renameSync(path, asidePath)
    const fresh = definition.defaults()
    save(fresh)
    return fresh
  }

  function load(): T {
    if (!existsSync(path)) {
      const fresh = definition.defaults()
      save(fresh)
      return fresh
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(readFileSync(path, 'utf8'))
    } catch {
      return quarantine('not valid JSON')
    }
    if (!isVersionedDocument(parsed)) return quarantine('missing schemaVersion')

    const migrated = runMigrations(parsed, definition.migrations, definition.schemaVersion)
    if (!migrated.ok) return quarantine(migrated.error)

    const data = migrated.value as T
    if (parsed.schemaVersion !== data.schemaVersion) save(data)
    return data
  }

  return { path, load, save }
}

export interface Settings extends VersionedDocument {
  schemaVersion: 1
}

export const settingsDefinition: StoreDefinition<Settings> = {
  fileName: 'settings.json',
  schemaVersion: 1,
  defaults: () => ({ schemaVersion: 1 }),
  migrations: settingsMigrations
}

export function createSettingsStore(dir: string): JsonStore<Settings> {
  return createJsonStore(dir, settingsDefinition)
}
