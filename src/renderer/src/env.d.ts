/// <reference types="vite/client" />
import type { Api } from '@shared/ipc'

declare global {
  interface Window {
    api: Api
  }
}

declare module 'react' {
  // A merged declaration must repeat React's type parameter name, though it isn't used here.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface HTMLAttributes<T> {
    /** Element Timing API (Chromium): names an element whose first paint is reported. */
    elementtiming?: string
  }
}
