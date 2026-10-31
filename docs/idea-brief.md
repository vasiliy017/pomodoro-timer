---
status: Draft
owner: "Vasiliy"
updated_at: "2026-10-31"
depth: "medium"
---

# Idea brief — pomodoro-timer

## 1. Raw idea

Repository context: README title "Pomodoro Timer". Owner's first answer (asked what to build, for
whom, what is missing today, where it runs, and why), verbatim:

> для публіки.
> в існуючих не вистачає душі та дизайнерської ізюминки.
> буде запускатись на desktop.
> можливий стек: тайпскрипт, реакт, електрон.
> я потребую це щоденно

## 2. Problem

- **Soulless transitions** (owner-reported): in the Pomodoro timers the owner knows, the
  experience feels "soulless" at two specific moments: the **end-of-session notification** and
  the **break**. Which apps were tried was not named.
- **Paid or ad-supported** (owner-reported, not market-verified): most existing options are paid
  or show ads.
- **Desired outcome** (owner-reported): a desktop timer with a pleasant color palette and fitting,
  smooth animations, where finishing a session and taking a break feel like a **ritual**.
- **Proposed solution, not a constraint yet:** TypeScript + React + Electron is named as a
  *possible* stack.

## 3. Users

- **The owner**, as a daily user (owner-reported: "я потребую це щоденно").
- **The public**: desktop users who work in Pomodoro sessions and want a free, calm, well-designed
  timer. This segment is an **assumption**. Nobody besides the owner has been asked.

## 4. Why now

No external trigger or deadline has been established. The motivation is the owner's own daily need
(owner-reported) and dissatisfaction with existing paid or ad-supported timers (owner-reported).

## 5. Out of scope

- **Ads, paid tiers and payments** (owner decision, Q3): the app is **free and open source**. The
  owner's complaint is that existing timers are paid or show ads, so ads and payments are excluded.
- **Windows and Linux in the first release** (owner decision, Q4): **macOS first**, because the
  owner develops on a Mac and can check the feel of the app there every day. The other platforms
  are deferred, not rejected.
- **Cloud sync** (accepted with the Q5 option "statistics / history without sync"): history stays
  local in v1.

## 6. Risks

1. **"Soul" is subjective (weakest assumption).** The whole product rests on the end-of-session
   moment and the break feeling like a ritual. Only the owner can judge that, and only through
   daily use. Reversible: the in-app ritual can be iterated on cheaply. Owner: Vasiliy.
2. **v1 scope versus reaching daily use.** v1 combines the ritual moments with polished animation,
   sounds, configurable durations, a menu-bar icon and local statistics. A staged "core first"
   option was offered (Q9) and not chosen. If polish delays a usable build, the success signal
   (daily use) is delayed too.
3. **Interruptiveness of the end-of-session window.** The owner chose (Q10) that the app shows its
   own window with animation and sound, plus a native notification as a fallback. A window
   appearing over other work can feel intrusive, which works against the calm "ritual" goal. How
   gentle it is matters as much as how it looks.
4. **First impression of an unsigned macOS app.** Without notarization, public users must go
   through Open Anyway (see the ledger). The owner accepted this for v1 (Q6). The impact on the
   public is unknown and does not affect the owner's own daily use.
5. **Unvalidated public segment.** The public's interest is an assumption. Success is deliberately
   measured only by the owner's daily use (Q7), so this does not block v1.

Critique was done inline by the interviewer. No independent devil's-advocate was dispatched: there
is no change to access, data or a public contract, the decisions are reversible, and no
stress-test was requested.

Evidence ledger:

| Claim / question | Class | Source / origin | Finding / limit |
|---|---|---|---|
| Existing timers feel soulless at session end and during the break | owner-reported | Q2 | The apps that were tried are not named. Not checked against any specific product. |
| Most existing timers are paid or ad-supported | owner-reported | Q2 | No market survey was done. |
| A native macOS notification cannot carry custom styling or animation | source-verified | Electron `Notification` API docs, https://www.electronjs.org/docs/latest/api/notification, read 2026-10-31 | The options cover content only (title, subtitle, body, icon, sound, actions, close-button label). Full design control (`toastXml`) is Windows-only. This checks Electron only. That native macOS banners are system-styled in general is an **assumption**. |
| Since macOS Sequoia, Control-click no longer opens an unsigned or un-notarized app; users must use System Settings → Privacy & Security → Open Anyway | source-verified (secondary) | MacRumors, 2024-08-06, https://www.macrumors.com/2024/08/06/macos-sequoia-gatekeeper-security-change/ ; AppleInsider, 2024-08-06 | These are press reports of Apple's announcement. Apple's own page was not read. One source (iDownloadBlog) reported a later beta reversal, which contradicts the others. Behavior on the current macOS is not verified on a device. |
| Notarization requires the paid Apple Developer Program, about $99 a year | assumption | General knowledge. developer.apple.com/support/compare-memberships was read 2026-10-31 but the price was not visible in it | Price and fee waivers not confirmed. |
| Open-source Windows apps can get free code signing through SignPath Foundation | source-verified (secondary) | Project pages, e.g. https://super-productivity.com/code-signing/ | Not relevant to the macOS-first v1. SignPath's own terms were not read. |
| A free, open-source, design-focused timer already exists | source-verified | https://github.com/Splode/pomotroid, read 2026-10-31 | Pomotroid: MIT, Tauri 2 + Svelte, "simple and visually-pleasing", 38 themes, custom alert sounds, configurable durations, about 5.6k stars. Release dates and maintenance status were not visible. This does not disprove "most are paid or ad-supported". Whether its session end and break feel "soulful" to the owner is **unknown**. |
| The public will want this app | assumption | none | Nobody besides the owner has been asked. |

## 7. Recommendation

**Direction (owner-accepted, Q10):** build a free, open-source desktop Pomodoro timer for macOS.
Its distinguishing quality is a pleasant color palette and fitting, smooth animations. The
**end of a session** and the **break** are designed as a ritual:

- **Session end:** the app gently brings up its own window with animation and sound (Q8, revised
  in Q9/Q10). A native macOS notification stays as a fallback signal.
- **Break:** the break experience happens inside the app's window.
- **Also in v1 (Q5):** sounds / ambient audio, configurable durations, a macOS menu-bar icon,
  and local statistics / history (no sync).
- **Distribution:** public builds on GitHub, unsigned for v1 (Q6). Open source, no ads or
  payments (Q3).

**Observable intended result (owner-accepted, Q7):** the owner uses the app every working day for
several weeks and does not go back to a previous timer. The exact number of weeks is not set.

**Main tradeoff:** the most expressive end-of-session moment (the app's own window) is also the
most interruptive, and v1 is broader than a minimal daily-use core.

**Alternatives considered:**

- *Native notification + sound only* (initially chosen in Q8, then revised): rejected because a
  native macOS banner cannot be styled or animated, and that is the very moment the owner called
  soulless.
- *Staged v1, core first* (Q9): not chosen. The owner kept the full v1 scope.
- *Try the existing free OSS timer Pomotroid first* (Q9): not chosen. It was not tried, so whether
  it already solves the problem is unknown (§8).
- *Windows/Linux in v1* (Q4): deferred.
- *Paid notarization from v1* (Q6): deferred.

The stack (TypeScript + React + Electron) is the owner's *possible* choice, not a decision of this
brief. It is left to design.

**Outcome: ready-for-specify**

**Next action:** `/sdd:specify pomodoro-timer`. Specify the ritual moments (session end, break)
first, since they carry the product's purpose.

## 8. Open questions

| Question | Consequence | Blocking? | Verification action | Owner |
|---|---|---|---|---|
| How gentle should the end-of-session window be? (steal focus or not, behavior over full-screen apps and other Spaces) | Too intrusive breaks the "ritual". Too quiet and the session end is missed. | nonblocking | Decide in specify, check by daily use | Vasiliy |
| Is Electron (or another stack) the right fit for smooth animations and showing a window over other apps on macOS? | Affects animation quality, app size and whether the window can appear over full-screen apps | nonblocking | Evaluate in design; spike if needed | Vasiliy |
| Where do sounds / ambient audio come from, and under what license? | An open-source app can only ship redistributable audio | nonblocking | Choose original or permissively licensed audio during specify/design | Vasiliy |
| Which open-source license? | Governs reuse, and audio/asset licensing must be compatible with it | nonblocking | Choose before the first public release | Vasiliy |
| Would Pomotroid (or another existing timer) already deliver the "soul"? | If yes, contributing could be cheaper than building | nonblocking (owner chose to build) | Optional: use it for a few days and note the gaps as input to specify | Vasiliy |
| Current Gatekeeper behavior for unsigned apps, and Apple Developer Program price | Affects public install friction and the cost of fixing it later | nonblocking | Test the unsigned build on the current macOS; read Apple's membership page | Vasiliy |
| How many weeks of daily use count as success? | Without a number, "success" stays a judgment call | nonblocking | Set during specify | Vasiliy |
