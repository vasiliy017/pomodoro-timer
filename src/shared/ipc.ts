import type { Result } from './result'
import type { CommandOutcome, TimerCommand, TimerSnapshot } from './timer'

/**
 * The single IPC contract between main and renderer. Every renderer → main call is listed here;
 * main registers handlers from it and the preload builds `window.api` from it, so neither side
 * hand-writes a channel string.
 */
export interface InvokeContract {
  ping: { args: [message: string]; result: string }
  timerGetState: { args: []; result: TimerSnapshot }
  timerCommand: { args: [command: TimerCommand]; result: CommandOutcome }
}

export type InvokeName = keyof InvokeContract
export type InvokeArgs<K extends InvokeName> = InvokeContract[K]['args']
export type InvokeResult<K extends InvokeName> = InvokeContract[K]['result']

export const invokeChannels: { readonly [K in InvokeName]: string } = {
  ping: 'app:ping',
  timerGetState: 'timer:get-state',
  timerCommand: 'timer:command'
}

/** Every main → renderer event and its payload (ADR-0007). Main sends them to every open window. */
export interface EventContract {
  timerState: TimerSnapshot
}

export type EventName = keyof EventContract

export const eventChannels: { readonly [K in EventName]: string } = {
  timerState: 'timer:state'
}

/** `onTimerState(listener)` and friends: subscribe to an event, get back the unsubscribe. */
type EventSubscriptions = {
  [K in EventName as `on${Capitalize<K>}`]: (
    listener: (payload: EventContract[K]) => void
  ) => () => void
}

/** The API the preload exposes as `window.api`. */
export type Api = {
  [K in InvokeName]: (...args: InvokeArgs<K>) => Promise<Result<InvokeResult<K>>>
} & EventSubscriptions
