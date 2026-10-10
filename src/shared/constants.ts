/** Plafond actuel. Tout le code est écrit pour N instances : relever cette valeur suffit. */
export const MAX_INSTANCES = 20

export const INSTANCE_COUNT_PRESETS = [1, 2, 4, 6, 9, 12, 16, 20] as const

export const DEFAULT_INSTANCE_COUNT = 4

export const DEFAULT_HOME_URL = 'https://duckduckgo.com/'

export const SEARCH_URL_TEMPLATE = 'https://duckduckgo.com/?q=%s'

/** Format de cellule visé par la grille automatique (largeur / hauteur). */
export const TARGET_CELL_ASPECT = 16 / 10

export const CELL_HEADER_HEIGHT = 24

/** Liseré laissé autour de la vue native pour que le cadre de la cellule reste visible. */
export const CELL_FRAME = 1

export const ZOOM_LIMITS = { min: 0.25, max: 3, step: 0.1 } as const

/** Les changements d'état des instances sont regroupés puis envoyés à l'interface à ce rythme. */
export const STATE_FLUSH_MS = 100

export const CONFIG_SAVE_DEBOUNCE_MS = 500
