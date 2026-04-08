import { PLANIZE_PUBLIC_FIREBASE_DEFAULTS } from './planizePublicFirebase'

export type FirebaseWebConfig = {
  apiKey: string
  authDomain: string
  projectId: string
  appId: string
}

function envNonEmptyFrom(map: Record<string, string | undefined>, key: string): string | undefined {
  const v = map[key]?.trim()
  return v && v.length > 0 ? v : undefined
}

/**
 * Lógica pura: útil em testes e em `resolveFirebaseWebConfig`.
 * Variáveis VITE_* preenchidas têm prioridade; vazio não sobrepõe defaults embutidos.
 */
export function mergeFirebaseWebConfig(
  viteEnv: Record<string, string | undefined>
): FirebaseWebConfig | null {
  const projectId = (
    envNonEmptyFrom(viteEnv, 'VITE_FIREBASE_PROJECT_ID') || PLANIZE_PUBLIC_FIREBASE_DEFAULTS.projectId
  ).trim()
  if (!projectId) return null

  const apiKey = (
    envNonEmptyFrom(viteEnv, 'VITE_FIREBASE_API_KEY') || PLANIZE_PUBLIC_FIREBASE_DEFAULTS.apiKey
  ).trim()
  const appId = (
    envNonEmptyFrom(viteEnv, 'VITE_FIREBASE_APP_ID') || PLANIZE_PUBLIC_FIREBASE_DEFAULTS.appId
  ).trim()
  const authDomain = (
    envNonEmptyFrom(viteEnv, 'VITE_FIREBASE_AUTH_DOMAIN') ||
    PLANIZE_PUBLIC_FIREBASE_DEFAULTS.authDomain ||
    `${projectId}.firebaseapp.com`
  ).trim()

  if (!apiKey || !appId) return null
  return { apiKey, authDomain, projectId, appId }
}
