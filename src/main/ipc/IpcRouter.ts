import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { InvokeChannel, IpcInvokeMap } from '@shared/ipc'
import { requestSchemas } from './schemas'

type Handler<C extends InvokeChannel> = (request: IpcInvokeMap[C]['req']) => IpcInvokeMap[C]['res'] | Promise<IpcInvokeMap[C]['res']>

/**
 * Point d'entrée unique des requêtes venant des interfaces : vérifie l'expéditeur
 * (une page de l'application, jamais une page web d'instance), puis la charge utile.
 */
export class IpcRouter {
  private readonly channels = new Set<InvokeChannel>()

  constructor(private readonly isTrustedSender: (event: IpcMainInvokeEvent) => boolean) {}

  handle<C extends InvokeChannel>(channel: C, handler: Handler<C>): void {
    const schema = requestSchemas[channel]
    this.channels.add(channel)
    ipcMain.handle(channel, (event, payload: unknown) => {
      if (!this.isTrustedSender(event)) throw new Error(`Expéditeur IPC non autorisé sur ${channel}`)
      const parsed = schema.safeParse(payload)
      if (!parsed.success) throw new Error(`Requête ${channel} invalide : ${parsed.error.issues.map((i) => i.message).join(', ')}`)
      return handler(parsed.data as IpcInvokeMap[C]['req'])
    })
  }

  dispose(): void {
    for (const channel of this.channels) ipcMain.removeHandler(channel)
    this.channels.clear()
  }
}
