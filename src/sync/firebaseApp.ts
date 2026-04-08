import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { resolveFirebaseWebConfig } from '../config/resolveFirebaseWebConfig'

export function isFirebaseConfigured(): boolean {
  return resolveFirebaseWebConfig() !== null
}

export function getFirebaseApp(): FirebaseApp {
  const cfg = resolveFirebaseWebConfig()
  if (!cfg) {
    throw new Error(
      'Firebase não está configurado nesta build. Quem mantém a app deve preencher src/config/planizePublicFirebase.ts ou VITE_FIREBASE_* na Vercel.'
    )
  }
  const existing = getApps()[0]
  if (existing) return existing
  return initializeApp(cfg)
}
