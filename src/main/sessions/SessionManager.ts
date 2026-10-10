import { session, type Session } from 'electron'
import { join } from 'node:path'
import type { ProfileId } from '@shared/types'
import { ProfileIdSchema } from '../config/schema'
import { SessionCookieStore } from './SessionCookieStore'

/** Permissions accordées aux pages ; tout le reste (caméra, micro, position, notifications…) est refusé. */
const ALLOWED_PERMISSIONS = new Set<string>(['clipboard-sanitized-write'])

const SESSION_COOKIES_FILE = 'mwm-session-cookies.bin'

interface Profile {
  session: Session
  cookies: SessionCookieStore
  ready: Promise<void>
}

/**
 * Un profil = un dossier `profiles/<id>/` = une Session Electron : cookies, localStorage,
 * IndexedDB, cache HTTP et service workers propres, conservés entre deux lancements.
 */
export class SessionManager {
  private readonly profiles = new Map<ProfileId, Profile>()

  constructor(private readonly root: string) {}

  pathFor(profileId: ProfileId): string {
    return join(this.root, ProfileIdSchema.parse(profileId))
  }

  get(profileId: ProfileId): Session {
    return this.profile(profileId).session
  }

  /** Résolue quand les cookies de session du lancement précédent sont remis dans le profil. */
  ready(profileId: ProfileId): Promise<void> {
    return this.profile(profileId).ready
  }

  /** Écrit sur le disque ce qui est encore en mémoire (à la fermeture). */
  async flushAll(): Promise<void> {
    const all = [...this.profiles.values()]
    for (const p of all) {
      p.cookies.flush()
      p.session.flushStorageData()
    }
    await Promise.all(all.map((p) => p.session.cookies.flushStore()))
  }

  private profile(profileId: ProfileId): Profile {
    let profile = this.profiles.get(profileId)
    if (!profile) {
      const dir = this.pathFor(profileId)
      const ses = session.fromPath(dir)
      configure(ses)
      const cookies = new SessionCookieStore(join(dir, SESSION_COOKIES_FILE), ses)
      const ready = cookies.restore().then(
        () => undefined,
        () => undefined
      )
      profile = { session: ses, cookies, ready }
      this.profiles.set(profileId, profile)
    }
    return profile
  }
}

function configure(ses: Session): void {
  ses.setPermissionRequestHandler((_contents, permission, callback) => callback(ALLOWED_PERMISSIONS.has(permission)))
  ses.setPermissionCheckHandler((_contents, permission) => ALLOWED_PERMISSIONS.has(permission))
}
