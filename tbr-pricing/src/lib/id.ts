/** Generate a short unique id (good enough for localStorage keys). */
export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}
