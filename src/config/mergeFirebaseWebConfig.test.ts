import { describe, expect, it } from 'vitest'
import { mergeFirebaseWebConfig } from './mergeFirebaseWebConfig'

describe('mergeFirebaseWebConfig', () => {
  it('usa defaults embutidos quando env está vazio', () => {
    const c = mergeFirebaseWebConfig({})
    expect(c).not.toBeNull()
    expect(c!.projectId).toBe('planize-520c3')
    expect(c!.apiKey.length).toBeGreaterThan(10)
    expect(c!.appId).toContain(':web:')
  })

  it('env vazio (string vazia) não sobrepõe defaults', () => {
    const c = mergeFirebaseWebConfig({
      VITE_FIREBASE_API_KEY: '',
      VITE_FIREBASE_APP_ID: '   ',
      VITE_FIREBASE_PROJECT_ID: '',
    })
    expect(c).not.toBeNull()
    expect(c!.apiKey.length).toBeGreaterThan(10)
  })

  it('env preenchido sobrepõe defaults', () => {
    const c = mergeFirebaseWebConfig({
      VITE_FIREBASE_API_KEY: 'key-override',
      VITE_FIREBASE_APP_ID: 'app-override',
      VITE_FIREBASE_PROJECT_ID: 'proj-override',
      VITE_FIREBASE_AUTH_DOMAIN: 'proj-override.firebaseapp.com',
    })
    expect(c).toEqual({
      apiKey: 'key-override',
      appId: 'app-override',
      projectId: 'proj-override',
      authDomain: 'proj-override.firebaseapp.com',
    })
  })

})
