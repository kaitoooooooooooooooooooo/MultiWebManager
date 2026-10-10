import { screen, type BrowserWindow } from 'electron'
import { execFileSync } from 'node:child_process'
import type { Point } from '@shared/input'

/**
 * Messages souris Windows postés directement à la fenêtre du mur (PostMessage) : ils
 * passent par le même chemin que la vraie souris dans Chromium, sans déplacer le curseur.
 */
export const WM = {
  MOUSEMOVE: 0x0200,
  LBUTTONDOWN: 0x0201,
  LBUTTONUP: 0x0202,
  LBUTTONDBLCLK: 0x0203,
  RBUTTONDOWN: 0x0204,
  RBUTTONUP: 0x0205,
  MOUSEWHEEL: 0x020a
} as const
export const MK_LBUTTON = 0x0001
export const MK_RBUTTON = 0x0002

export interface OsStep {
  msg: number
  wParam?: number
  lParam: number
  waitMs?: number
}

export const packPoint = (p: Point) => ((p.y & 0xffff) << 16) | (p.x & 0xffff)
export const wheelWParam = (delta: number) => (delta & 0xffff) << 16

/** Point de la fenêtre du mur (DIP, origine = zone client) → coordonnées client physiques. */
export function clientPoint(wall: BrowserWindow, local: Point): Point {
  const content = wall.getContentBounds()
  const origin = screen.dipToScreenPoint({ x: content.x, y: content.y })
  const p = screen.dipToScreenPoint({ x: content.x + local.x, y: content.y + local.y })
  return { x: p.x - origin.x, y: p.y - origin.y }
}

export function screenPoint(wall: BrowserWindow, local: Point): Point {
  const content = wall.getContentBounds()
  return screen.dipToScreenPoint({ x: content.x + local.x, y: content.y + local.y })
}

export function postToWindow(win: BrowserWindow, steps: OsStep[]): void {
  const hwnd = win.getNativeWindowHandle().readBigUInt64LE(0).toString()
  const lines = steps
    .map((s) => `[U]::PostMessage($h, ${s.msg}, [IntPtr](${s.wParam ?? 0}), [IntPtr](${s.lParam})) | Out-Null` + (s.waitMs ? `; Start-Sleep -Milliseconds ${s.waitMs}` : ''))
    .join('\n')
  execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Add-Type @"
using System; using System.Runtime.InteropServices;
public static class U { [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l); }
"@
$h = [IntPtr]::new([Int64]${hwnd})
${lines}`
    ],
    { stdio: 'pipe', windowsHide: true }
  )
}

/**
 * Un vrai cran de molette au-dessus de `target` : le curseur y est placé ~0,2 s puis remis.
 * Réservé au test optionnel « molette réelle » (il prend la souris un instant).
 */
export function realWheelNotch(target: Point, delta: number): void {
  execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Add-Type @"
using System; using System.Runtime.InteropServices;
public struct P { public int X; public int Y; }
public static class U {
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out P p);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, int dx, int dy, int data, IntPtr extra);
}
"@
$p = New-Object P; [U]::GetCursorPos([ref]$p) | Out-Null
[U]::SetCursorPos(${target.x}, ${target.y}) | Out-Null
Start-Sleep -Milliseconds 80
[U]::mouse_event(0x0800, 0, 0, ${delta}, [IntPtr]::Zero)
Start-Sleep -Milliseconds 120
[U]::SetCursorPos($p.X, $p.Y) | Out-Null`
    ],
    { stdio: 'pipe', windowsHide: true }
  )
}
