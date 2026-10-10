import { createServer, type Server } from 'node:http'

/**
 * Site de test du selftest, sur 127.0.0.1 uniquement. Port fixe : les URL restaurées d'un
 * lancement à l'autre doivent rester valides. La page journalise elle-même ce qu'elle
 * reçoit (rien n'est injecté par l'application) et l'envoie au serveur.
 */
export const PROBE_PORT = 47913
export const PROBE_ORIGIN = `http://127.0.0.1:${PROBE_PORT}`

export interface PageEvent {
  id: number
  t: string
  x: number
  y: number
  b: number
  bs: number
  d: number
  tr: boolean
  dy?: number
}

export interface PageRequest {
  path: string
  cookie: string
}

const PAGE = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Sonde MWM</title></head>
<body style="margin:0;height:400vh;background:#151a22;color:#7d8590;font:13px system-ui">
<p style="position:fixed;top:6px;left:8px;margin:0">Page de test du selftest Multi Web Manager</p>
<script>
const id = Number((document.cookie.match(/mwm_probe_id=(\\d+)/) || [])[1] || 0);
let buffer = [];
const log = (e) => buffer.push({ id, t: e.type, x: e.clientX, y: e.clientY, b: e.button, bs: e.buttons, d: e.detail, tr: e.isTrusted, dy: e.deltaY });
for (const type of ['mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'wheel']) addEventListener(type, log, { capture: true });
addEventListener('mousemove', (e) => { if (e.buttons) log(e); }, { capture: true });
setInterval(() => {
  if (!buffer.length) return;
  const body = JSON.stringify(buffer);
  buffer = [];
  fetch('/log', { method: 'POST', body, keepalive: true });
}, 40);
</script></body></html>`

export class ProbeServer {
  readonly events: PageEvent[] = []
  readonly requests: PageRequest[] = []
  private server: Server | null = null

  start(): Promise<void> {
    this.server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', PROBE_ORIGIN)
      if (req.method === 'POST' && url.pathname === '/log') {
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', () => {
          try {
            this.events.push(...(JSON.parse(body) as PageEvent[]))
          } catch {
            // lot illisible : ignoré
          }
          res.writeHead(204).end()
        })
        return
      }
      this.requests.push({ path: url.pathname + url.search, cookie: req.headers.cookie ?? '' })
      if (url.pathname === '/login') {
        // Cookie de session (aucune date d'expiration), comme une connexion sans « rester connecté ».
        res.writeHead(302, { 'set-cookie': `mwm_login=${url.searchParams.get('i')}; Path=/; HttpOnly`, location: '/probe?step=2' }).end()
        return
      }
      if (url.pathname === '/probe') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(PAGE)
        return
      }
      res.writeHead(404).end()
    })
    return new Promise((resolve, reject) => {
      this.server!.once('error', reject)
      this.server!.listen(PROBE_PORT, '127.0.0.1', () => resolve())
    })
  }

  clearEvents(): void {
    this.events.length = 0
  }
}
