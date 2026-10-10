import type { MwmApi } from '../shared/ipc'

declare global {
  interface Window {
    mwm: MwmApi
  }
}

export {}
