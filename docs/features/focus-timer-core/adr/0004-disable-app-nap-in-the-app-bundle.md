---
status: Accepted
owner: "Vasiliy"
reviewers: []
updated_at: "2026-10-31"
feature_size: "M"
ticket: ""
---

# 0004 — Disable App Nap in the app bundle with `NSAppSleepDisabled`

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Vasiliy (owner), with Claude during the `design` pass (resolves spec §8 Q2 as a decision; on-device verification remains)

## Context

App Nap is the macOS mode that throttles an app whose windows are hidden. Its timers are
coalesced and can be delayed by seconds or more. focus-timer-core relies on one timeout in main
to detect each phase end ([ADR-0003](0003-arm-one-deadline-timeout-in-main.md)), usually with the
window hidden or closed. Spec §8 Q2 asks whether meeting the 1 s detection target requires
stopping this suspension, and whether doing so breaks the background-energy target.

## Decision drivers

- Spec §6 NFR *Phase-end detection latency*: ≤ 1 s, window hidden or closed, Mac awake.
- Spec §6 NFR *Background resource use*: ≤ 1% average CPU over 10 minutes and Energy Impact «Low».
- AC-14: real system sleep (lid closed, Sleep from the menu, automatic sleep) must keep happening
  and be handled. The app must not keep the Mac awake.

## Considered options

1. **`NSAppSleepDisabled = true` in the app's `Info.plist`.** This is set through electron-builder
   `mac.extendInfo` in `electron-builder.yml`. It is Apple's documented per-app opt-out of App
   Nap. It takes no power assertion, so system sleep is unaffected.
2. **`powerSaveBlocker.start('prevent-app-suspension')` only while a phase runs.** On macOS,
   Electron implements this as an `IOPMAssertion` of type `NoIdleSleep`. It stops App Nap, but it
   also stops the Mac from idle-sleeping for up to 25 minutes per phase.
3. **No opt-out, measure first.** Leave App Nap on and run an on-device spike. Add option 1 only if
   the detection delay exceeds 1 s.

## Decision outcome

**Chosen:** option 1. It removes the throttling that would break the 1 s target. It needs no
start/stop logic in code, and unlike option 2 it never holds the Mac awake. The cost is low:
between deadlines main runs no timers (ADR-0003), so an app that is never napped has nothing to
wake for. Option 3 was rejected because App Nap often kicks in only after long background
stretches, so a short spike could falsely pass.

## Consequences

**Positive**
- The phase-end and midnight timeouts fire on time with the window closed.
- macOS's automatic sleep still happens, and the AC-14 sleep rules stay reachable.
- No code path to forget: the key is static bundle metadata.

**Negative**
- The key exists only in the packaged `.app`. `npm run dev` runs under Electron's own
  `Info.plist`, so the dev build can still be napped. Both NFRs must be verified on a packaged
  build (SAD §11).
- App Nap is off for the app's whole lifetime, not only while a phase runs. With nothing armed,
  this costs nothing measurable, but it is broader than strictly needed.

**Neutral**
- If on-device checks show App Nap is not the bottleneck (Chromium may already opt out), the key
  is harmless and can be removed with a one-line change.

## Links

- Spec: [[../spec.md]] §8 Q2, §6 Phase-end detection latency, Background resource use, AC-05, AC-14
- SAD: [[../sad.md]] §4, §7, §11
- Related ADR: [[0003-arm-one-deadline-timeout-in-main]]
