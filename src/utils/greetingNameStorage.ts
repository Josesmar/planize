import { PLANIZE_GREETING_NAME_KEY } from '../constants/storageKeys'

const MAX = 80

/** Nome de saudação guardado neste aparelho (independente do timing do Zustand/Firestore). */
export function readGreetingNameFromDevice(): string {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(PLANIZE_GREETING_NAME_KEY)?.trim().slice(0, MAX) ?? ''
  } catch {
    return ''
  }
}

export function writeGreetingNameToDevice(name: string): void {
  if (typeof window === 'undefined') return
  const t = name.trim().slice(0, MAX)
  try {
    if (t) window.localStorage.setItem(PLANIZE_GREETING_NAME_KEY, t)
    else window.localStorage.removeItem(PLANIZE_GREETING_NAME_KEY)
  } catch {
    /* quota / privado */
  }
}
