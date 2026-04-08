import { useEffect, useState } from 'react'
import { useFirebaseAuth } from '../auth/FirebaseAuthProvider'
import { PLANIZE_LAST_CONTROL_CODE_KEY, PLANIZE_LAST_LOGIN_EMAIL_KEY } from '../constants/storageKeys'
import { useStore } from '../store'
import { isFirebaseConfigured } from '../sync/firebaseApp'
import { createWorkspaceByControlCode, joinWorkspaceByControlCode } from '../sync/workspaceAcl'

function firebaseAuthMessage(e: unknown): string {
  const code =
    typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: string }).code) : ''
  if (code === 'auth/invalid-email') return 'Email inválido.'
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Email ou senha inválidos.'
  }
  if (code === 'auth/email-already-in-use') return 'Este email já está cadastrado.'
  if (code === 'auth/weak-password') return 'Senha fraca. Use pelo menos 6 caracteres.'
  if (code === 'auth/too-many-requests') return 'Muitas tentativas. Aguarde um pouco e tente novamente.'
  if (code === 'permission-denied') return 'Sem permissão para entrar nesse controle.'
  return e instanceof Error ? e.message : 'Não foi possível enviar os convites.'
}

export function CloudAccessPanel() {
  const { user, loading, signOutUser } = useFirebaseAuth()
  const months = useStore(s => s.months)
  const currentMonthId = useStore(s => s.currentMonthId)
  const ui = useStore(s => s.ui)
  const templates = useStore(s => s.templates)
  const syncWorkspaceId = useStore(s => s.syncWorkspaceId)
  const setSyncWorkspaceId = useStore(s => s.setSyncWorkspaceId)
  const setSyncWorkspaceMeta = useStore(s => s.setSyncWorkspaceMeta)
  const setPendingJoinRequestId = useStore(s => s.setPendingJoinRequestId)

  const [controlCode, setControlCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [savedControlHint, setSavedControlHint] = useState('')
  const sessionEmail = user?.email?.toLowerCase() ?? ''
  const canControlSubmit = controlCode.trim().length >= 4

  useEffect(() => {
    if (typeof window === 'undefined') return
    setSavedControlHint(window.localStorage.getItem(PLANIZE_LAST_CONTROL_CODE_KEY)?.trim() ?? '')
  }, [syncWorkspaceId])

  function persistLoginHints(code: string) {
    if (typeof window === 'undefined') return
    const c = code.trim()
    if (c.length >= 4) window.localStorage.setItem(PLANIZE_LAST_CONTROL_CODE_KEY, c)
    if (sessionEmail) window.localStorage.setItem(PLANIZE_LAST_LOGIN_EMAIL_KEY, sessionEmail)
    setSavedControlHint(c)
  }

  async function handleCreateControl() {
    setMsg(null)
    if (!sessionEmail) {
      setMsg('Faça login antes de criar o controle.')
      return
    }
    setBusy(true)
    try {
      const wsId = await createWorkspaceByControlCode(controlCode, sessionEmail, {
        months,
        currentMonthId,
        ui,
        templates,
      })
      setSyncWorkspaceMeta({ ownerEmail: sessionEmail, allowedEmails: [sessionEmail] })
      setSyncWorkspaceId(wsId)
      setPendingJoinRequestId(null)
      persistLoginHints(controlCode)
      setMsg('Controle criado e nuvem ativada.')
    } catch (e) {
      setMsg(firebaseAuthMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleJoinControl() {
    setMsg(null)
    if (!sessionEmail) {
      setMsg('Faça login antes de entrar no controle.')
      return
    }
    setBusy(true)
    try {
      const { workspaceId, meta } = await joinWorkspaceByControlCode(controlCode, sessionEmail)
      setSyncWorkspaceMeta({
        ownerEmail: meta.ownerEmail,
        allowedEmails: [...new Set(meta.allowedEmails)].sort(),
      })
      setSyncWorkspaceId(workspaceId)
      setPendingJoinRequestId(null)
      persistLoginHints(controlCode)
      setMsg('Conectado ao controle com sucesso.')
    } catch (e) {
      setMsg(firebaseAuthMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (!isFirebaseConfigured()) {
    return (
      <div className="mt-2 space-y-3 text-xs leading-relaxed text-muted">
        <p>
          <strong className="text-textMain">Porque não vejo ajustes de nuvem?</strong> Esses campos só
          aparecem quando o Firebase está ligado nesta instalação. Aqui a nuvem está desligada — por isso não há onde
          preencher ainda.
        </p>
        <p>
          Quem <strong className="text-textMain">só usa</strong> o telemóvel não configura nada: quem publica a app
          (Vercel + Firebase) tem de o fazer uma vez para todos.
        </p>
        {import.meta.env.DEV ? (
          <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 text-[0.6875rem] light:border-indigo-300 light:bg-indigo-50/60">
            <p className="font-semibold text-textMain">No seu PC (modo dev)</p>
            <p className="mt-1.5 font-medium text-amber-200 light:text-amber-900">
              1) Pare o servidor (<kbd className="rounded bg-black/25 px-1">Ctrl+C</kbd> no terminal). 2) Corra outra vez{' '}
              <code className="rounded bg-black/20 px-1">npm run dev</code>. 3) Recarregue a página com{' '}
              <kbd className="rounded bg-black/25 px-1">Cmd+Shift+R</kbd> / hard refresh. O carimbo «Interface» no fim
              de Ajustes tem de mostrar uma <strong className="text-textMain">hora nova</strong> — se continuar antigo,
              ainda está a ver código velho em cache.
            </p>
            <p className="mt-2">
              O projeto já traz <code className="rounded bg-black/20 px-1">apiKey</code> e{' '}
              <code className="rounded bg-black/20 px-1">appId</code> em{' '}
              <code className="rounded bg-black/20 px-1">src/config/planizePublicFirebase.ts</code> — depois de
              reiniciar o Vite, os campos da nuvem devem aparecer <strong className="text-textMain">sem .env</strong>.
            </p>
            <p className="mt-2">
              Se ainda não aparecerem: apague ou corrija{' '}
              <code className="rounded bg-black/20 px-1">.env.production.local</code> se tiver linhas{' '}
              <code className="rounded bg-black/20 px-1">VITE_FIREBASE_*</code> vazias ou erradas; ou preencha com os
              valores da Firebase Console, por exemplo:
            </p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-bg/80 p-2 font-mono text-[0.625rem] text-textMain">
              {`VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_PROJECT_ID=planize-520c3
VITE_FIREBASE_AUTH_DOMAIN=planize-520c3.firebaseapp.com
VITE_APP_URL=http://localhost:5173/`}
            </pre>
          </div>
        ) : (
          <p className="rounded-lg border border-border bg-card/40 px-3 py-2 text-[0.6875rem]">
            Se esta app é oficial e a nuvem devia funcionar, quem gere o deploy precisa de definir{' '}
            <code className="rounded bg-black/15 px-1">VITE_FIREBASE_*</code> na Vercel (ou preencher{' '}
            <code className="rounded bg-black/15 px-1">planizePublicFirebase.ts</code>) e publicar de novo.
          </p>
        )}
      </div>
    )
  }

  const advancedForm = (
    <div className="mt-2 space-y-2 border-t border-border pt-3">
      <p className="text-[0.625rem] text-muted leading-relaxed">
        Só precisa disto se quiser <strong className="text-textMain">outro</strong> código de controle sem sair da conta.
        O fluxo normal é no ecrã de login ao abrir a app.
      </p>
      <div className="space-y-1.5">
        <label htmlFor="cloud-control-code-adv" className="text-xs font-medium text-textMain">
          Código do controle
        </label>
        <input
          id="cloud-control-code-adv"
          type="text"
          autoComplete="off"
          value={controlCode}
          onChange={e => setControlCode(e.target.value)}
          placeholder="ex.: 12345"
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-textMain outline-none ring-primary focus:ring-2"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy || !canControlSubmit}
          onClick={() => void handleCreateControl()}
          className="rounded-lg bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Criar controle
        </button>
        <button
          type="button"
          disabled={busy || !canControlSubmit}
          onClick={() => void handleJoinControl()}
          className="rounded-lg border border-primary/60 bg-primary/15 py-2.5 text-sm font-semibold text-textMain disabled:opacity-50 light:bg-indigo-100"
        >
          Entrar no controle
        </button>
      </div>
    </div>
  )

  return (
    <div className="mt-3 space-y-3">
      {loading ? <p className="text-xs text-muted">A carregar sessão…</p> : null}

      {user?.email ? (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-[0.6875rem] text-muted">
            Sessão ativa: <strong className="text-textMain">{user.email}</strong>
          </p>

          {syncWorkspaceId ? (
            <>
              <div className="rounded-lg border border-border bg-bg px-3 py-2">
                <p className="text-xs text-muted">Nuvem ativa neste aparelho.</p>
                {savedControlHint ? (
                  <p className="mt-2 text-[0.6875rem] text-muted">
                    Código guardado neste aparelho:{' '}
                    <strong className="font-mono text-textMain">{savedControlHint}</strong>
                    <span className="block pt-1 text-[0.625rem] opacity-90">
                      (o mesmo que no login; pode partilhar com quem for entrar no mesmo controle)
                    </span>
                  </p>
                ) : (
                  <p className="mt-2 text-[0.625rem] text-muted">
                    O código ficará visível aqui depois de um acesso bem-sucedido pelo ecrã de login.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setSyncWorkspaceId(null)}
                  className="mt-3 text-xs font-semibold text-red-400 light:text-red-700"
                >
                  Desligar nuvem neste aparelho
                </button>
              </div>

              <details className="group rounded-lg border border-border bg-card/30 px-3 py-2">
                <summary className="cursor-pointer text-xs font-medium text-textMain marker:text-muted">
                  Avançado: trocar ou criar outro controle
                </summary>
                {advancedForm}
              </details>
            </>
          ) : (
            advancedForm
          )}

          <button
            type="button"
            onClick={() => void signOutUser()}
            className="text-xs text-muted underline decoration-dotted underline-offset-2"
          >
            Sair desta conta
          </button>
        </div>
      ) : null}

      {msg ? <p className="text-xs text-muted leading-relaxed">{msg}</p> : null}
    </div>
  )
}
