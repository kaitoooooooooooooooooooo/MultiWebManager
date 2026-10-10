import { create } from 'zustand'
import type { AppSnapshot } from '@shared/ipc'
import type { AppMeta, InstanceId, InstanceState, WallLayout } from '@shared/types'

interface AppStore {
  byId: Record<InstanceId, InstanceState>
  layout: WallLayout | null
  meta: AppMeta | null
  hydrate(snapshot: AppSnapshot): void
  applyPatch(states: InstanceState[]): void
  setLayout(layout: WallLayout): void
  setMeta(meta: AppMeta): void
}

/**
 * Miroir local de l'état du processus principal. Les composants lisent une seule instance
 * à la fois (`useInstance`) : un changement sur WEB 03 ne redessine que la cellule 03.
 */
export const useAppStore = create<AppStore>()((set) => ({
  byId: {},
  layout: null,
  meta: null,
  hydrate: (snapshot) =>
    set({ byId: Object.fromEntries(snapshot.instances.map((s) => [s.id, s])), layout: snapshot.layout, meta: snapshot.meta }),
  applyPatch: (states) =>
    set((current) => {
      const byId = { ...current.byId }
      for (const state of states) byId[state.id] = state
      return { byId }
    }),
  setLayout: (layout) => set({ layout }),
  setMeta: (meta) =>
    set((current) => {
      const kept = new Set(meta.order)
      const pruned = Object.values(current.byId).some((s) => !kept.has(s.id))
      return pruned ? { meta, byId: Object.fromEntries(Object.entries(current.byId).filter(([id]) => kept.has(Number(id)))) } : { meta }
    })
}))

export const useInstance = (id: InstanceId) => useAppStore((s) => s.byId[id])
export const useMeta = () => useAppStore((s) => s.meta)

export function connectStore(): () => void {
  const { hydrate, applyPatch, setLayout, setMeta } = useAppStore.getState()
  const offs = [
    window.mwm.on('instances:patch', applyPatch),
    window.mwm.on('wall:layout', setLayout),
    window.mwm.on('app:meta', setMeta)
  ]
  void window.mwm.invoke('app:get-snapshot').then(hydrate)
  return () => offs.forEach((off) => off())
}
