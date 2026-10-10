import type { Cookie, CookiesSetDetails, Session } from 'electron'
import { readSecureJson, writeSecureJson } from '../storage/secureFile'

type StoredCookie = Pick<Cookie, 'name' | 'value' | 'domain' | 'hostOnly' | 'path' | 'secure' | 'httpOnly' | 'sameSite'>

const SAVE_DEBOUNCE_MS = 2000

const keyOf = (c: Pick<Cookie, 'domain' | 'path' | 'name'>) => `${c.domain}|${c.path}|${c.name}`

function toDetails(c: StoredCookie): CookiesSetDetails {
  const host = (c.domain ?? '').replace(/^\./, '')
  return {
    url: `${c.secure ? 'https' : 'http'}://${host}${c.path ?? '/'}`,
    name: c.name,
    value: c.value,
    domain: c.hostOnly ? undefined : c.domain,
    path: c.path,
    secure: c.secure,
    httpOnly: c.httpOnly,
    sameSite: c.sameSite
  }
}

/**
 * Chromium jette à la fermeture les cookies « de session » (sans date d'expiration), que
 * beaucoup de sites utilisent pour la connexion. Ce magasin en garde une copie chiffrée par
 * profil et les remet au démarrage, comme « Reprendre là où vous en étiez » de Chrome.
 */
export class SessionCookieStore {
  private readonly cookies = new Map<string, StoredCookie>()
  private timer: NodeJS.Timeout | null = null

  constructor(
    private readonly file: string,
    private readonly session: Session
  ) {}

  /** Remet les cookies du lancement précédent, puis suit les changements. Renvoie le nombre remis. */
  async restore(): Promise<number> {
    const saved = readSecureJson<StoredCookie[]>(this.file) ?? []
    let restored = 0
    for (const cookie of saved) {
      try {
        await this.session.cookies.set(toDetails(cookie))
        restored++
      } catch {
        // Cookie refusé par Chromium (domaine invalide, préfixe __Host- incohérent…) : ignoré.
      }
    }
    this.session.cookies.on('changed', (_event, cookie, _cause, removed) => {
      if (removed || !cookie.session) this.cookies.delete(keyOf(cookie))
      else this.cookies.set(keyOf(cookie), pick(cookie))
      this.scheduleSave()
    })
    for (const cookie of await this.session.cookies.get({})) {
      if (cookie.session) this.cookies.set(keyOf(cookie), pick(cookie))
    }
    return restored
  }

  flush(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    writeSecureJson(this.file, [...this.cookies.values()])
  }

  private scheduleSave(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.flush(), SAVE_DEBOUNCE_MS)
  }
}

function pick(c: Cookie): StoredCookie {
  return { name: c.name, value: c.value, domain: c.domain, hostOnly: c.hostOnly, path: c.path, secure: c.secure, httpOnly: c.httpOnly, sameSite: c.sameSite }
}
