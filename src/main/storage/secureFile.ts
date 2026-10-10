import { safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * JSON chiffré par Windows (DPAPI, lié au compte utilisateur) : même protection que la base
 * de cookies de Chromium. Sert aux données de session (cookies, historique avec formulaires).
 * Écriture atomique : un arrêt brutal laisse l'ancien fichier intact.
 */
export function writeSecureJson(file: string, data: unknown): boolean {
  if (!safeStorage.isEncryptionAvailable()) return false
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  writeFileSync(tmp, safeStorage.encryptString(JSON.stringify(data)))
  renameSync(tmp, file)
  return true
}

export function readSecureJson<T>(file: string): T | null {
  if (!existsSync(file) || !safeStorage.isEncryptionAvailable()) return null
  try {
    return JSON.parse(safeStorage.decryptString(readFileSync(file))) as T
  } catch {
    return null
  }
}

export function removeFile(file: string): void {
  rmSync(file, { force: true })
}
