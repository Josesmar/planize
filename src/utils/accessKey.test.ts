import { describe, expect, it } from 'vitest'
import { accessKeyFromOwnerEmail, isValidAccessKey } from './accessKey'

describe('accessKeyFromOwnerEmail', () => {
  it('produz chave estável e válida para o mesmo email', () => {
    const a = accessKeyFromOwnerEmail('titular@exemplo.com')
    const b = accessKeyFromOwnerEmail('titular@exemplo.com')
    expect(a).toBe(b)
    expect(isValidAccessKey(a)).toBe(true)
  })

  it('emails diferentes produzem chaves diferentes', () => {
    expect(accessKeyFromOwnerEmail('a@x.com')).not.toBe(accessKeyFromOwnerEmail('b@x.com'))
  })
})
