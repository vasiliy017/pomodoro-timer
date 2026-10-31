import type { Result } from './result'

/**
 * The single IPC contract between main and renderer. Every renderer → main call is listed here;
 * main registers handlers from it and the preload builds `window.api` from it, so neither side
 * hand-writes a channel string.
 */
export interface InvokeContract {
  ping: { args: [message: string]; result: string }
}

export type InvokeName = keyof InvokeContract
export type InvokeArgs<K extends InvokeName> = InvokeContract[K]['args']
export type InvokeResult<K extends InvokeName> = InvokeContract[K]['result']

export const invokeChannels: { readonly [K in InvokeName]: string } = {
  ping: 'app:ping'
}

/** The API the preload exposes as `window.api`. */
export type Api = {
  [K in InvokeName]: (...args: InvokeArgs<K>) => Promise<Result<InvokeResult<K>>>
}
