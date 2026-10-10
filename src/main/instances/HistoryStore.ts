import type { NavigationEntry } from 'electron'
import { join } from 'node:path'
import { isAllowedNavigationUrl } from '@shared/url'
import type { InstanceId } from '@shared/types'
import { readSecureJson, removeFile, writeSecureJson } from '../storage/secureFile'

export interface HistorySnapshot {
  entries: NavigationEntry[]
  index: number
}

/** Chrome garde 50 entrées par onglet ; on fait de même. */
const MAX_ENTRIES = 50

/**
 * Historique précédent/suivant de chaque case, avec l'état des pages (défilement,
 * champs de formulaire) : chiffré, car il peut contenir ce qui a été saisi.
 */
export class HistoryStore {
  constructor(private readonly dir: string) {}

  save(id: InstanceId, snapshot: HistorySnapshot): void {
    writeSecureJson(this.fileFor(id), trim(snapshot))
  }

  /** Historique restaurable dont la page active est `expectedUrl`, sinon null. */
  load(id: InstanceId, expectedUrl: string): HistorySnapshot | null {
    const saved = readSecureJson<HistorySnapshot>(this.fileFor(id))
    if (!saved || !Array.isArray(saved.entries)) return null
    const active = saved.entries[saved.index]
    if (!active || active.url !== expectedUrl) return null
    const entries = saved.entries.filter((e) => typeof e?.url === 'string' && isAllowedNavigationUrl(e.url))
    const index = entries.indexOf(active)
    return index >= 0 ? { entries, index } : null
  }

  remove(id: InstanceId): void {
    removeFile(this.fileFor(id))
  }

  private fileFor(id: InstanceId): string {
    return join(this.dir, `instance-${String(id).padStart(2, '0')}.bin`)
  }
}

function trim({ entries, index }: HistorySnapshot): HistorySnapshot {
  if (entries.length <= MAX_ENTRIES) return { entries, index }
  const start = Math.min(Math.max(0, index - MAX_ENTRIES + 1), entries.length - MAX_ENTRIES)
  return { entries: entries.slice(start, start + MAX_ENTRIES), index: index - start }
}
