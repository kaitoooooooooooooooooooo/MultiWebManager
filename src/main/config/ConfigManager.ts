import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { CONFIG_SAVE_DEBOUNCE_MS } from '@shared/constants'
import type { AppConfig } from '@shared/types'
import { createDefaultConfig } from './defaults'
import { parseConfig } from './schema'

export class ConfigManager {
  private config: AppConfig = createDefaultConfig()
  private saveTimer: NodeJS.Timeout | null = null

  constructor(private readonly file: string) {}

  load(): AppConfig {
    if (!existsSync(this.file)) {
      this.config = createDefaultConfig()
      this.writeNow()
      return this.config
    }
    try {
      const parsed = parseConfig(JSON.parse(readFileSync(this.file, 'utf8')))
      if (!parsed) throw new Error('structure invalide')
      this.config = parsed
    } catch (error) {
      const backup = this.file.replace(/\.json$/, `.invalid-${Date.now()}.json`)
      console.warn(`[config] ${this.file} illisible (${String(error)}), copie dans ${backup}, valeurs par défaut`)
      renameSync(this.file, backup)
      this.config = createDefaultConfig()
      this.writeNow()
    }
    return this.config
  }

  get current(): Readonly<AppConfig> {
    return this.config
  }

  update(mutate: (config: AppConfig) => void): void {
    mutate(this.config)
    this.scheduleSave()
  }

  /** Écrit immédiatement ce qui est en attente (à appeler avant de quitter). */
  flush(): void {
    if (!this.saveTimer) return
    clearTimeout(this.saveTimer)
    this.saveTimer = null
    this.writeNow()
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      this.writeNow()
    }, CONFIG_SAVE_DEBOUNCE_MS)
  }

  /** Écriture atomique : un arrêt brutal laisse l'ancien fichier intact, jamais un fichier tronqué. */
  private writeNow(): void {
    mkdirSync(dirname(this.file), { recursive: true })
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(this.config, null, 2), 'utf8')
    renameSync(tmp, this.file)
  }
}
