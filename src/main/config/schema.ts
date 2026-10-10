import { z } from 'zod'
import { DEFAULT_HOME_URL, MAX_INSTANCES, ZOOM_LIMITS } from '@shared/constants'
import { isAllowedNavigationUrl } from '@shared/url'
import type { AppConfig } from '@shared/types'
import { DEFAULT_DISPLAYS, DEFAULT_GRID, createDefaultProfile } from './defaults'

export const ProfileIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/, 'Identifiant de profil invalide')

export const NavigableUrlSchema = z.string().max(8192).refine(isAllowedNavigationUrl, 'URL non autorisée')

const InstanceSchema = z.object({
  id: z.number().int().min(1).max(9999),
  name: z.string().trim().min(1).max(40),
  url: NavigableUrlSchema.catch('about:blank'),
  profileId: ProfileIdSchema,
  zoom: z.number().min(ZOOM_LIMITS.min).max(ZOOM_LIMITS.max).catch(1),
  active: z.boolean().catch(true)
})

const ProfileSchema = z.object({
  id: ProfileIdSchema,
  name: z.string().trim().min(1).max(40)
})

const GridSchema = z.object({
  mode: z.enum(['auto', 'manual']).catch(DEFAULT_GRID.mode),
  columns: z.number().int().min(1).max(MAX_INSTANCES).catch(DEFAULT_GRID.columns),
  rows: z.number().int().min(1).max(MAX_INSTANCES).catch(DEFAULT_GRID.rows),
  spacing: z.number().int().min(0).max(32).catch(DEFAULT_GRID.spacing),
  showLabels: z.boolean().catch(DEFAULT_GRID.showLabels),
  showStatus: z.boolean().catch(DEFAULT_GRID.showStatus)
})

const DisplayIdSchema = z.number().int().nullable()

const DisplaysSchema = z.object({
  wallDisplayId: DisplayIdSchema.catch(null),
  adminDisplayId: DisplayIdSchema.catch(null),
  wallFullscreen: z.boolean().catch(false)
})

/** Lecture tolérante : un champ ou une instance invalide est corrigé ou écarté, pas tout le fichier. */
const FileSchema = z.object({
  version: z.literal(1),
  homeUrl: NavigableUrlSchema.catch(DEFAULT_HOME_URL),
  instances: z.array(InstanceSchema.nullable().catch(null)).catch([]),
  profiles: z.array(ProfileSchema.nullable().catch(null)).catch([]),
  grid: GridSchema.catch({ ...DEFAULT_GRID }),
  displays: DisplaysSchema.catch({ ...DEFAULT_DISPLAYS }),
  control: z.object({ mouseSync: z.boolean().catch(false) }).catch({ mouseSync: false }),
  selectedId: z.number().int().nullable().catch(null)
})

export function parseConfig(raw: unknown): AppConfig | null {
  const parsed = FileSchema.safeParse(raw)
  if (!parsed.success) return null
  const data = parsed.data

  const seen = new Set<number>()
  const instances = data.instances
    .filter((i) => i !== null)
    .filter((i) => !seen.has(i.id) && seen.add(i.id))
    .slice(0, MAX_INSTANCES)

  const profiles = new Map(data.profiles.filter((p) => p !== null).map((p) => [p.id, p]))
  for (const instance of instances) {
    if (!profiles.has(instance.profileId)) {
      const n = Number(instance.profileId.match(/(\d+)$/)?.[1] ?? instance.id)
      profiles.set(instance.profileId, { ...createDefaultProfile(n), id: instance.profileId })
    }
  }

  const selectedId = instances.some((i) => i.id === data.selectedId) ? data.selectedId : (instances[0]?.id ?? null)
  return {
    version: 1,
    homeUrl: data.homeUrl,
    instances,
    profiles: [...profiles.values()],
    grid: data.grid,
    displays: data.displays,
    control: data.control,
    selectedId
  }
}
