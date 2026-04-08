import { describe, expect, it } from 'vitest'
import { buildInviteLinkSteps } from './inviteEmailSequence'

describe('buildInviteLinkSteps', () => {
  it('só titular: um passo, persist por omissão', () => {
    const steps = buildInviteLinkSteps('owner@test.com', [])
    expect(steps).toEqual([{ email: 'owner@test.com', options: {} }])
  })

  it('titular + convidados: titular primeiro sem persist:false; convidados com persist false e convite', () => {
    const steps = buildInviteLinkSteps('owner@test.com', ['guest1@test.com', 'guest2@test.com'])
    expect(steps).toHaveLength(3)
    expect(steps[0]).toEqual({ email: 'owner@test.com', options: {} })
    expect(steps[1]).toEqual({
      email: 'guest1@test.com',
      options: { conviteTitularEmail: 'owner@test.com', persistPendingEmail: false },
    })
    expect(steps[2]).toEqual({
      email: 'guest2@test.com',
      options: { conviteTitularEmail: 'owner@test.com', persistPendingEmail: false },
    })
  })

  it('remove titular se estiver na lista de convidados', () => {
    const steps = buildInviteLinkSteps('owner@test.com', ['owner@test.com', 'g@test.com'])
    expect(steps).toHaveLength(2)
    expect(steps[1].email).toBe('g@test.com')
  })

  it('normaliza email do titular em minúsculas', () => {
    const steps = buildInviteLinkSteps('Owner@Test.COM', [])
    expect(steps[0].email).toBe('owner@test.com')
  })
})
