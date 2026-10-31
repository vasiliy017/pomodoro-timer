import { err, ok, type Result } from '@shared/result'

export interface VersionedDocument {
  schemaVersion: number
  [key: string]: unknown
}

/** A pure upgrade of a document from one schemaVersion to the next. */
export type Migration = (doc: VersionedDocument) => VersionedDocument

/** Migrations keyed by the version they upgrade FROM: `{ 1: migrate_v1_to_v2 }`. */
export type MigrationChain = Readonly<Record<number, Migration>>

/**
 * Upgrades `doc` step by step to `targetVersion`. Every step must be present in the chain;
 * a gap, a document newer than the app, or a step that forgets to bump the version is an error.
 */
export function runMigrations(
  doc: VersionedDocument,
  chain: MigrationChain,
  targetVersion: number
): Result<VersionedDocument> {
  if (doc.schemaVersion > targetVersion) {
    return err(`schemaVersion ${doc.schemaVersion} is newer than supported ${targetVersion}`)
  }

  let current = doc
  while (current.schemaVersion < targetVersion) {
    const from = current.schemaVersion
    const step = chain[from]
    if (!step) return err(`no migration from schemaVersion ${from}`)
    current = step(current)
    if (current.schemaVersion !== from + 1) {
      return err(`migration from schemaVersion ${from} produced ${current.schemaVersion}`)
    }
  }
  return ok(current)
}

/** settings.json — v1 is the initial schema, so the chain is empty. */
export const settingsMigrations: MigrationChain = {}
