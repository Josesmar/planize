import type { FirebaseWebConfig } from './mergeFirebaseWebConfig'
import { mergeFirebaseWebConfig } from './mergeFirebaseWebConfig'

export type { FirebaseWebConfig }

export function resolveFirebaseWebConfig(): FirebaseWebConfig | null {
  return mergeFirebaseWebConfig(import.meta.env as Record<string, string | undefined>)
}
