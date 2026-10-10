/** Plus petit identifiant libre : WEB 05 supprimée puis recréée reprend le n° 5 et son profil. */
export function nextFreeId(used: Iterable<number>): number {
  const taken = new Set(used)
  let id = 1
  while (taken.has(id)) id++
  return id
}
