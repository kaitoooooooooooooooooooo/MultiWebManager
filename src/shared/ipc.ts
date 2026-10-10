import type { AppMeta, GridConfig, InstanceId, InstanceState, WallLayout } from './types'

/**
 * Contrat IPC entre les interfaces (Wall, Admin) et le processus principal.
 * Les noms de canaux sont les seuls autorisés par le preload ; les charges utiles
 * sont revalidées côté principal (src/main/ipc/schemas.ts).
 */

export interface AppSnapshot {
  instances: InstanceState[]
  layout: WallLayout | null
  meta: AppMeta
}

export type CommandResult = { ok: true } | { ok: false; error: string }
export type CreateResult = { ok: true; id: InstanceId } | { ok: false; error: string }

interface Target {
  id: InstanceId
}

export interface IpcInvokeMap {
  'app:get-snapshot': { req: void; res: AppSnapshot }
  'instance:navigate': { req: Target & { url: string }; res: CommandResult }
  'instance:reload': { req: Target; res: CommandResult }
  'instance:go-back': { req: Target; res: CommandResult }
  'instance:go-forward': { req: Target; res: CommandResult }
  'instance:stop-loading': { req: Target; res: CommandResult }
  'instance:start': { req: Target; res: CommandResult }
  'instance:stop': { req: Target; res: CommandResult }
  'instance:restart': { req: Target; res: CommandResult }
  'instance:create': { req: void; res: CreateResult }
  'instance:delete': { req: Target; res: CommandResult }
  'instance:set-count': { req: { count: number }; res: CommandResult }
  'instance:rename': { req: Target & { name: string }; res: CommandResult }
  'instance:set-zoom': { req: Target & { zoom: number }; res: CommandResult }
  'instance:open-devtools': { req: Target; res: CommandResult }
  'selection:set': { req: { id: InstanceId | null }; res: CommandResult }
  'instances:navigate-all': { req: { url: string }; res: CommandResult }
  'instances:reload-all': { req: void; res: CommandResult }
  'instances:set-zoom-all': { req: { zoom: number }; res: CommandResult }
  'sync:set-mouse': { req: { enabled: boolean }; res: CommandResult }
  'grid:update': { req: Partial<GridConfig>; res: CommandResult }
  'displays:assign': { req: { wall: number; admin: number }; res: CommandResult }
  'wall:set-fullscreen': { req: { fullscreen: boolean }; res: CommandResult }
  'window:switch': { req: void; res: CommandResult }
}

export interface IpcEventMap {
  /** États des instances qui ont changé depuis le dernier envoi. */
  'instances:patch': InstanceState[]
  'wall:layout': WallLayout
  'app:meta': AppMeta
}

export type InvokeChannel = keyof IpcInvokeMap
export type EventChannel = keyof IpcEventMap

export const INVOKE_CHANNELS = [
  'app:get-snapshot',
  'instance:navigate',
  'instance:reload',
  'instance:go-back',
  'instance:go-forward',
  'instance:stop-loading',
  'instance:start',
  'instance:stop',
  'instance:restart',
  'instance:create',
  'instance:delete',
  'instance:set-count',
  'instance:rename',
  'instance:set-zoom',
  'instance:open-devtools',
  'selection:set',
  'instances:navigate-all',
  'instances:reload-all',
  'instances:set-zoom-all',
  'sync:set-mouse',
  'grid:update',
  'displays:assign',
  'wall:set-fullscreen',
  'window:switch'
] as const satisfies readonly InvokeChannel[]

export const EVENT_CHANNELS = ['instances:patch', 'wall:layout', 'app:meta'] as const satisfies readonly EventChannel[]

type InvokeArgs<C extends InvokeChannel> = IpcInvokeMap[C]['req'] extends void ? [] : [IpcInvokeMap[C]['req']]

/** API exposée aux interfaces par le preload sous `window.mwm`. */
export interface MwmApi {
  invoke<C extends InvokeChannel>(channel: C, ...args: InvokeArgs<C>): Promise<IpcInvokeMap[C]['res']>
  on<E extends EventChannel>(channel: E, listener: (payload: IpcEventMap[E]) => void): () => void
}
