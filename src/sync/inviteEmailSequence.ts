/** Opções alinhadas com `SendSignInLinkOptions` em FirebaseAuthProvider. */
export type InviteLinkOptions = {
  conviteTitularEmail?: string
  persistPendingEmail?: boolean
}

export type InviteLinkStep = {
  email: string
  options: InviteLinkOptions
}

/**
 * Ordem correta: primeiro titular (persiste email no browser), depois convidados sem persistir,
 * para o titular no mesmo PC não ficar com o email do último convidado (INVALID_OOB_CODE).
 */
export function buildInviteLinkSteps(ownerEmail: string, guestEmails: string[]): InviteLinkStep[] {
  const owner = ownerEmail.trim().toLowerCase()
  const guests = guestEmails.filter(e => e !== owner)
  return [
    { email: owner, options: {} },
    ...guests.map(email => ({
      email,
      options: {
        conviteTitularEmail: owner,
        persistPendingEmail: false,
      },
    })),
  ]
}
