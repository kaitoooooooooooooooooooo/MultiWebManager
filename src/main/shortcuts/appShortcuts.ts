import { app } from 'electron'

/** Touche de bascule mur ⇄ admin. Rendue configurable avec le gestionnaire de raccourcis (phase 5). */
export const SWITCH_WINDOW_KEY = 'F2'

interface AppShortcutActions {
  switchWindow(): void
}

/**
 * Écoute le clavier de tous les WebContents (interfaces, pages des instances, popups) :
 * une page web a le focus la plupart du temps, c'est donc là que la touche arrive.
 */
export function installAppShortcuts(actions: AppShortcutActions): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown' || input.isAutoRepeat) return
      const plain = !input.control && !input.alt && !input.shift && !input.meta
      if (plain && input.key === SWITCH_WINDOW_KEY) {
        event.preventDefault()
        actions.switchWindow()
      }
    })
  })
}
