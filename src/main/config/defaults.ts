import { DEFAULT_HOME_URL, DEFAULT_INSTANCE_COUNT } from '@shared/constants'
import type { AppConfig, DisplayPrefs, GridConfig, InstanceConfig, ProfileConfig } from '@shared/types'

const pad = (n: number) => String(n).padStart(2, '0')

export const profileIdFor = (n: number) => `profile-${pad(n)}`
export const instanceNameFor = (n: number) => `WEB ${pad(n)}`

export const DEFAULT_GRID: GridConfig = {
  mode: 'auto',
  columns: 4,
  rows: 5,
  spacing: 2,
  showLabels: true,
  showStatus: true
}

export const DEFAULT_DISPLAYS: DisplayPrefs = {
  wallDisplayId: null,
  adminDisplayId: null,
  wallFullscreen: false
}

export function createDefaultInstance(id: number, url = DEFAULT_HOME_URL): InstanceConfig {
  return { id, name: instanceNameFor(id), url, profileId: profileIdFor(id), zoom: 1, active: true }
}

export function createDefaultProfile(n: number): ProfileConfig {
  return { id: profileIdFor(n), name: `Profil ${pad(n)}` }
}

export function createDefaultConfig(count = DEFAULT_INSTANCE_COUNT): AppConfig {
  const ids = Array.from({ length: count }, (_, i) => i + 1)
  return {
    version: 1,
    homeUrl: DEFAULT_HOME_URL,
    instances: ids.map((id) => createDefaultInstance(id)),
    profiles: ids.map(createDefaultProfile),
    grid: { ...DEFAULT_GRID },
    displays: { ...DEFAULT_DISPLAYS },
    control: { mouseSync: false },
    selectedId: ids[0] ?? null
  }
}
