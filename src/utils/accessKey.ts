/** Normaliza a chave de acesso (ex.: "1", "casa-2024"). */
export function normalizeAccessKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64)
}

export function isValidAccessKey(key: string): boolean {
  return key.length >= 4
}

export function newWorkspaceId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `w-${crypto.randomUUID()}`
  return `w-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/** Chave estável derivada do email do titular (utilizador não precisa de ver nem escrever). */
export function accessKeyFromOwnerEmail(ownerEmail: string): string {
  const e = ownerEmail.trim().toLowerCase()
  let h1 = 2166136261
  let h2 = 5381
  for (let i = 0; i < e.length; i++) {
    const c = e.charCodeAt(i)
    h1 ^= c
    h1 = Math.imul(h1, 16777619)
    h2 = Math.imul(h2, 33) ^ c
  }
  const a = (h1 >>> 0).toString(36)
  const b = (h2 >>> 0).toString(36)
  const k = normalizeAccessKey(`g-${a}-${b}`)
  return k.length >= 4 ? k.slice(0, 64) : 'g-planize-grp'
}
