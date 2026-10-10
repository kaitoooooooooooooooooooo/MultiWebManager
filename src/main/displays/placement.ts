import type { DisplayInfo, DisplayPlacement, DisplayPrefs } from '@shared/types'

/**
 * Écran du mur : celui choisi s'il est toujours branché, sinon l'écran principal.
 * Écran de l'admin : celui choisi s'il existe et diffère du mur, sinon le premier autre écran,
 * sinon le même que le mur (mode un seul écran, avec bascule).
 */
export function resolvePlacement(displays: readonly DisplayInfo[], prefs: Pick<DisplayPrefs, 'wallDisplayId' | 'adminDisplayId'>): DisplayPlacement {
  if (displays.length === 0) throw new Error('Aucun écran détecté')
  const primary = displays.find((d) => d.primary) ?? displays[0]
  const wall = displays.find((d) => d.id === prefs.wallDisplayId) ?? primary
  const admin =
    displays.find((d) => d.id === prefs.adminDisplayId && d.id !== wall.id) ??
    displays.find((d) => d.id !== wall.id && d.id === primary.id) ??
    displays.find((d) => d.id !== wall.id) ??
    wall
  return { wall: wall.id, admin: admin.id, singleScreen: admin.id === wall.id }
}
