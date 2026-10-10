import { SEARCH_URL_TEMPLATE } from './constants'

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

/** Un schéma explicite (« mailto: », « file: »…), mais pas « hote:8080 ». */
const SCHEME = /^[a-z][a-z0-9+.-]*:(?!\d)/i
const HOST = /^(localhost|\[::1\]|\d{1,3}(\.\d{1,3}){3}|([\p{L}\p{N}-]+\.)+\p{L}{2,})(:\d{1,5})?([/?#]|$)/iu
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])([:/?#]|$)/i

/** Seules les pages web (et about:blank) peuvent être chargées dans une instance. */
export function isAllowedNavigationUrl(raw: string): boolean {
  if (raw === 'about:blank') return true
  try {
    return ALLOWED_PROTOCOLS.has(new URL(raw).protocol)
  } catch {
    return false
  }
}

export type NormalizeResult = { ok: true; url: string } | { ok: false; reason: string }

/**
 * Transforme ce que l'utilisateur tape dans la barre d'adresse en URL chargeable :
 * URL complète, domaine nu (schéma ajouté) ou, à défaut, recherche.
 */
export function normalizeUserUrl(input: string, searchTemplate = SEARCH_URL_TEMPLATE): NormalizeResult {
  const text = input.trim()
  if (!text) return { ok: false, reason: 'Adresse vide' }

  if (SCHEME.test(text)) {
    if (!isAllowedNavigationUrl(text)) return { ok: false, reason: 'Seules les adresses http(s) sont autorisées' }
    return { ok: true, url: text === 'about:blank' ? text : new URL(text).href }
  }

  if (!/\s/.test(text) && HOST.test(text)) {
    const candidate = (LOCAL_HOST.test(text) ? 'http://' : 'https://') + text
    if (isAllowedNavigationUrl(candidate)) return { ok: true, url: new URL(candidate).href }
  }

  return { ok: true, url: searchTemplate.replace('%s', encodeURIComponent(text)) }
}
