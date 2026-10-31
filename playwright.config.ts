import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  // The specs measure launch time and UI latency (spec.md §6): one Electron app at a time.
  workers: 1,
  reporter: process.env['CI'] ? 'github' : 'list'
})
