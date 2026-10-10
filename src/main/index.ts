import { app } from 'electron'
import { Application } from './Application'
import { runSelfTest, SELFTEST_FLAG, selfTestUserData, startSelfTestServer } from './dev/selfTest'

/** Au-delà, on quitte même si l'écriture des cookies n'a pas répondu. */
const QUIT_SAVE_TIMEOUT_MS = 5000

const selfTest = process.argv.includes(SELFTEST_FLAG)
if (selfTest) app.setPath('userData', selfTestUserData())

// Les dossiers de profils ne supportent qu'un seul processus à la fois.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  // Fermer le mur ou l'admin ferme l'application : tout est sauvegardé avant.
  const application = new Application(app.getPath('userData'), () => app.quit())

  let saved = false
  app.on('before-quit', (event) => {
    if (saved) return
    event.preventDefault()
    const timeout = new Promise((resolve) => setTimeout(resolve, QUIT_SAVE_TIMEOUT_MS))
    void Promise.race([application.persistBeforeQuit(), timeout])
      .catch(() => undefined)
      .finally(() => {
        saved = true
        app.quit()
      })
  })

  app.on('second-instance', () => application.windows.focusWall())
  app.on('window-all-closed', () => app.quit())
  app.on('will-quit', () => application.shutdown())

  void app.whenReady().then(async () => {
    if (!selfTest) return application.start()
    const probe = await startSelfTestServer()
    application.start()
    await runSelfTest(application, probe)
  })
}
