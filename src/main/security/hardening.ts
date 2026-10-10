import { app } from 'electron'

/** Règles valables pour tout WebContents créé par l'application, y compris les popups des pages. */
export function hardenAllWebContents(): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event) => event.preventDefault())
  })
}
