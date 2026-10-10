import { execFile } from 'node:child_process'

/** Valeur par défaut de Windows (Paramètres → Souris → « lignes à faire défiler »). */
export const DEFAULT_WHEEL_LINES = 3

/**
 * Lignes par cran de molette réglées dans Windows, lues dans le registre. -1 (« un écran à
 * la fois ») ou une lecture impossible donnent la valeur par défaut.
 */
export function readWheelScrollLines(): Promise<number> {
  return new Promise((resolve) => {
    execFile('reg', ['query', 'HKCU\\Control Panel\\Desktop', '/v', 'WheelScrollLines'], { windowsHide: true }, (error, stdout) => {
      const value = error ? NaN : Number(/WheelScrollLines\s+REG_\w+\s+(-?\d+)/.exec(stdout)?.[1])
      resolve(Number.isInteger(value) && value > 0 ? value : DEFAULT_WHEEL_LINES)
    })
  })
}
