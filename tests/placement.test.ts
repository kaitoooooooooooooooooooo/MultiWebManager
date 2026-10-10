import { describe, expect, it } from 'vitest'
import { resolvePlacement } from '../src/main/displays/placement'
import { nextFreeId } from '../src/main/instances/ids'
import type { DisplayInfo } from '../src/shared/types'

const display = (id: number, primary = false): DisplayInfo => ({
  id,
  label: `D${id}`,
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  workArea: { x: 0, y: 0, width: 1920, height: 1040 },
  scaleFactor: 1,
  primary
})
const none = { wallDisplayId: null, adminDisplayId: null }

describe('resolvePlacement', () => {
  it('un seul écran : mur et admin le partagent', () => {
    expect(resolvePlacement([display(1, true)], none)).toEqual({ wall: 1, admin: 1, singleScreen: true })
  })

  it('deux écrans sans préférence : mur sur le principal, admin sur l’autre', () => {
    expect(resolvePlacement([display(7), display(3, true)], none)).toEqual({ wall: 3, admin: 7, singleScreen: false })
  })

  it('respecte les préférences, y compris inversées', () => {
    expect(resolvePlacement([display(7), display(3, true)], { wallDisplayId: 7, adminDisplayId: 3 })).toEqual({ wall: 7, admin: 3, singleScreen: false })
  })

  it('écran préféré débranché : retombe sur ce qui existe', () => {
    expect(resolvePlacement([display(3, true)], { wallDisplayId: 7, adminDisplayId: 3 })).toEqual({ wall: 3, admin: 3, singleScreen: true })
    expect(resolvePlacement([display(3, true), display(9)], { wallDisplayId: 7, adminDisplayId: 8 })).toEqual({ wall: 3, admin: 9, singleScreen: false })
  })

  it('mur déplacé sur l’écran secondaire : l’admin prend le principal', () => {
    expect(resolvePlacement([display(1, true), display(2), display(3)], { wallDisplayId: 2, adminDisplayId: null })).toEqual({ wall: 2, admin: 1, singleScreen: false })
  })

  it('admin et mur demandés sur le même écran avec deux écrans : l’admin prend l’autre', () => {
    expect(resolvePlacement([display(1, true), display(2)], { wallDisplayId: 1, adminDisplayId: 1 })).toEqual({ wall: 1, admin: 2, singleScreen: false })
  })

  it('refuse une liste d’écrans vide', () => {
    expect(() => resolvePlacement([], none)).toThrow()
  })
})

describe('nextFreeId', () => {
  it('prend le plus petit numéro libre', () => {
    expect(nextFreeId([])).toBe(1)
    expect(nextFreeId([1, 2, 3])).toBe(4)
    expect(nextFreeId([1, 2, 4, 5])).toBe(3)
    expect(nextFreeId([2, 3])).toBe(1)
  })
})
