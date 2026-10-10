export type InstanceId = number
export type ProfileId = string

export type InstanceStatus = 'idle' | 'loading' | 'connected' | 'error' | 'paused' | 'stopped'

export interface InstanceConfig {
  id: InstanceId
  name: string
  url: string
  profileId: ProfileId
  zoom: number
  /** Faux = instance arrêtée : sa case reste dans la grille, mais sans page ni processus. */
  active: boolean
}

export interface ProfileConfig {
  id: ProfileId
  name: string
}

export type GridMode = 'auto' | 'manual'

export interface GridConfig {
  mode: GridMode
  columns: number
  rows: number
  spacing: number
  showLabels: boolean
  showStatus: boolean
}

export interface DisplayPrefs {
  wallDisplayId: number | null
  adminDisplayId: number | null
  wallFullscreen: boolean
}

export interface ControlPrefs {
  /** Les actions souris faites dans une case sont reproduites dans toutes les autres. */
  mouseSync: boolean
}

export interface AppConfig {
  version: 1
  homeUrl: string
  instances: InstanceConfig[]
  profiles: ProfileConfig[]
  grid: GridConfig
  displays: DisplayPrefs
  control: ControlPrefs
  selectedId: InstanceId | null
}

export interface LoadError {
  code: number | string
  description: string
  url: string
}

export interface InstanceState {
  id: InstanceId
  name: string
  url: string
  title: string
  status: InstanceStatus
  canGoBack: boolean
  canGoForward: boolean
  zoom: number
  profileId: ProfileId
  error: LoadError | null
  /** Horodatage (ms) de la dernière fin de chargement réussie. */
  loadedAt: number | null
}

export interface Size {
  width: number
  height: number
}

export interface Rect extends Size {
  x: number
  y: number
}

export interface CellLayout {
  id: InstanceId
  cell: Rect
  header: Rect | null
  view: Rect
}

export interface WallLayout {
  width: number
  height: number
  columns: number
  rows: number
  cells: CellLayout[]
}

export interface DisplayInfo {
  id: number
  label: string
  bounds: Rect
  workArea: Rect
  scaleFactor: number
  primary: boolean
}

/** Écran retenu pour chaque fenêtre. `singleScreen` : les deux partagent le même écran. */
export interface DisplayPlacement {
  wall: number
  admin: number
  singleScreen: boolean
}

/** État global de l'application, hors état détaillé des instances. */
export interface AppMeta {
  order: InstanceId[]
  maxInstances: number
  grid: GridConfig
  selectedId: InstanceId | null
  displays: DisplayInfo[]
  placement: DisplayPlacement
  wallFullscreen: boolean
  control: ControlPrefs
}
