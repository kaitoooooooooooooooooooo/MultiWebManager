import { z } from 'zod'
import { MAX_INSTANCES } from '@shared/constants'
import type { InvokeChannel } from '@shared/ipc'

const InstanceIdSchema = z.number().int().min(1).max(9999)
const Target = z.object({ id: InstanceIdSchema }).strict()
const DisplayIdSchema = z.number().int()

const GridPatchSchema = z
  .object({
    mode: z.enum(['auto', 'manual']),
    columns: z.number().int().min(1).max(MAX_INSTANCES),
    rows: z.number().int().min(1).max(MAX_INSTANCES),
    spacing: z.number().int().min(0).max(32),
    showLabels: z.boolean(),
    showStatus: z.boolean()
  })
  .partial()
  .strict()

/** Forme attendue de chaque requête : tout message non conforme est rejeté avant d'atteindre un service. */
export const requestSchemas = {
  'app:get-snapshot': z.undefined(),
  'instance:navigate': z.object({ id: InstanceIdSchema, url: z.string().min(1).max(8192) }).strict(),
  'instance:reload': Target,
  'instance:go-back': Target,
  'instance:go-forward': Target,
  'instance:stop-loading': Target,
  'instance:start': Target,
  'instance:stop': Target,
  'instance:restart': Target,
  'instance:create': z.undefined(),
  'instance:delete': Target,
  'instance:set-count': z.object({ count: z.number().int().min(1).max(MAX_INSTANCES) }).strict(),
  'instance:rename': z.object({ id: InstanceIdSchema, name: z.string().trim().min(1).max(40) }).strict(),
  'instance:set-zoom': z.object({ id: InstanceIdSchema, zoom: z.number().finite() }).strict(),
  'instance:open-devtools': Target,
  'selection:set': z.object({ id: InstanceIdSchema.nullable() }).strict(),
  'instances:navigate-all': z.object({ url: z.string().min(1).max(8192) }).strict(),
  'instances:reload-all': z.undefined(),
  'instances:set-zoom-all': z.object({ zoom: z.number().finite() }).strict(),
  'sync:set-mouse': z.object({ enabled: z.boolean() }).strict(),
  'grid:update': GridPatchSchema,
  'displays:assign': z.object({ wall: DisplayIdSchema, admin: DisplayIdSchema }).strict(),
  'wall:set-fullscreen': z.object({ fullscreen: z.boolean() }).strict(),
  'window:switch': z.undefined()
} satisfies Record<InvokeChannel, z.ZodType>
