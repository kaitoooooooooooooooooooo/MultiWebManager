export type CheckFn = (name: string, ok: boolean, detail?: unknown) => void

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function until(condition: () => boolean | Promise<boolean>, timeoutMs = 5000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await condition()) return true
    await sleep(100)
  }
  return false
}
