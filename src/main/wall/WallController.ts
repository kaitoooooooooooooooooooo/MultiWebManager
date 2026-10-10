import type { BrowserWindow } from 'electron'
import { computeWallLayout } from '@shared/layout'
import type { WallLayout } from '@shared/types'
import type { ConfigManager } from '../config/ConfigManager'
import type { InstanceManager } from '../instances/InstanceManager'

/**
 * Tient la grille du mur : calcule les cellules à partir de la taille de la fenêtre,
 * place les vues natives et transmet la même géométrie à l'interface qui dessine les cadres.
 */
export class WallController {
  private layout: WallLayout | null = null

  constructor(
    private readonly win: BrowserWindow,
    private readonly instances: InstanceManager,
    private readonly config: ConfigManager,
    private readonly publish: (layout: WallLayout) => void
  ) {
    instances.attach(win.contentView)
    const relayout = () => this.relayout()
    win.on('resize', relayout)
    win.on('maximize', relayout)
    win.on('unmaximize', relayout)
    win.on('restore', relayout)
    win.on('enter-full-screen', relayout)
    win.on('leave-full-screen', relayout)
    this.relayout()
  }

  get current(): WallLayout | null {
    return this.layout
  }

  relayout(): void {
    if (this.win.isDestroyed()) return
    const [width, height] = this.win.getContentSize()
    const layout = computeWallLayout({ width, height }, this.instances.ids(), this.config.current.grid)
    this.instances.applyLayout(layout)
    const changed = JSON.stringify(layout) !== JSON.stringify(this.layout)
    this.layout = layout
    if (changed) this.publish(layout)
  }
}
