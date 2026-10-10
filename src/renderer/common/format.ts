/** URL lisible en peu de place : hôte + chemin, sans le schéma. */
export function displayUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.protocol.startsWith('http') ? `${u.host}${u.pathname === '/' ? '' : u.pathname}${u.search}` : url
  } catch {
    return url
  }
}

export function timeSince(from: number, now: number): string {
  const s = Math.max(0, Math.round((now - from) / 1000))
  if (s < 60) return `il y a ${s} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  return `il y a ${h} h ${String(m % 60).padStart(2, '0')}`
}

export const percent = (zoom: number) => `${Math.round(zoom * 100)} %`
