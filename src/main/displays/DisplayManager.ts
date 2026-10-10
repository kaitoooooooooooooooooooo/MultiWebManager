import { screen, type Display } from 'electron'
import type { DisplayInfo } from '@shared/types'

/** Un branchement d'écran déclenche plusieurs événements d'affilée : on n'agit qu'une fois. */
const CHANGE_COALESCE_MS = 300

export class DisplayManager {
  private timer: NodeJS.Timeout | null = null

  list(): DisplayInfo[] {
    const primaryId = screen.getPrimaryDisplay().id
    return screen.getAllDisplays().map((display, index) => toInfo(display, index, primaryId))
  }

  get(id: number): DisplayInfo | undefined {
    return this.list().find((d) => d.id === id)
  }

  onChange(listener: () => void): void {
    const schedule = () => {
      if (this.timer) clearTimeout(this.timer)
      this.timer = setTimeout(() => {
        this.timer = null
        listener()
      }, CHANGE_COALESCE_MS)
    }
    screen.on('display-added', schedule)
    screen.on('display-removed', schedule)
    screen.on('display-metrics-changed', schedule)
  }
}

function toInfo(display: Display, index: number, primaryId: number): DisplayInfo {
  return {
    id: display.id,
    label: display.label || `Écran ${index + 1}`,
    bounds: { ...display.bounds },
    workArea: { ...display.workArea },
    scaleFactor: display.scaleFactor,
    primary: display.id === primaryId
  }
}
