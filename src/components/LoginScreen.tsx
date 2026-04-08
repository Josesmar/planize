import { useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, KeyRound, LogIn, UserPlus, Wallet } from 'lucide-react'
import { useStore } from '../store'
import { useFirebaseAuth } from '../auth/FirebaseAuthProvider'
import {
  PLANIZE_LAST_CONTROL_CODE_KEY,
  PLANIZE_LAST_LOGIN_EMAIL_KEY,
  PLANIZE_POST_LOGIN_WELCOME_KEY,
} from '../constants/storageKeys'
import { createWorkspaceByControlCode, joinWorkspaceByControlCode } from '../sync/workspaceAcl'
type AuthMode = 'login' | 'register'

function isEmailAlreadyInUse(e: unknown): boolean {
  const code =
    typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: string }).code) : ''
  if (code === 'auth/email-already-in-use') return true
  const raw = e instanceof Error ? e.message : ''
  return /EMAIL_EXISTS|email-already-in-use/i.test(raw)
}

function authErrorMessage(e: unknown): string {
  const code =
    typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: string }).code) : ''
  if (code === 'auth/invalid-email') return 'Email inválido.'
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Email ou senha inválidos.'
  }
  if (code === 'auth/email-already-in-use') {
    return 'Este email já tem conta. Use a mesma senha e o código; em «Primeiro acesso» a app tenta entrar por si se a conta já existir.'
  }
  if (code === 'auth/weak-password') return 'Senha fraca. Use pelo menos 6 caracteres.'
  if (code === 'auth/too-many-requests') return 'Muitas tentativas. Aguarde um pouco e tente novamente.'
  if (code === 'permission-denied') {
    return (
      'O Firestore recusou o acesso. No Firebase Console → Firestore → Regras, publique as regras do projeto (não pode ficar «allow read, write: if false»). Depois tente de novo.'
    )
  }
  if (e instanceof Error && /controle não encontrado/i.test(e.message)) {
    return 'Controle não encontrado. Confirme o código com quem criou o controle ou use «Primeiro acesso» se ainda ninguém tiver criado esse código.'
  }
  const raw = e instanceof Error ? e.message : ''
  if (/EMAIL_EXISTS|email-already-in-use/i.test(raw)) {
    return 'Este email já tem conta. Use a mesma senha e o código (ou «Já tenho conta»).'
  }
  return e instanceof Error ? e.message : 'Não foi possível autenticar.'
}

export default function LoginScreen() {
  const theme = useStore(s => s.ui?.theme ?? 'dark')
  const months = useStore(s => s.months)
  const currentMonthId = useStore(s => s.currentMonthId)
  const ui = useStore(s => s.ui)
  const templates = useStore(s => s.templates)
  const setSyncWorkspaceId = useStore(s => s.setSyncWorkspaceId)
  const setSyncWorkspaceMeta = useStore(s => s.setSyncWorkspaceMeta)
  const setPendingJoinRequestId = useStore(s => s.setPendingJoinRequestId)
  const { signInWithPassword, registerWithPassword, user: authUser, signOutUser } = useFirebaseAuth()
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [controlCode, setControlCode] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const canLogin = useMemo(
    () =>
      email.trim().includes('@') &&
      password.trim().length > 0 &&
      controlCode.trim().length >= 4,
    [email, password, controlCode]
  )
  const canRegister = canLogin

  useEffect(() => {
    setSyncWorkspaceId(null)
  }, [setSyncWorkspaceId])

  /** Já há sessão Firebase mas o app ainda pede código — evita signUp acidental em «Primeiro acesso». */
  useEffect(() => {
    if (authUser?.email?.trim()) {
      setMode('login')
    }
  }, [authUser?.email])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem(PLANIZE_LAST_LOGIN_EMAIL_KEY)?.trim()
    if (saved) setEmail(saved)
    const savedCode = window.localStorage.getItem(PLANIZE_LAST_CONTROL_CODE_KEY)?.trim()
    if (savedCode) setControlCode(savedCode)
  }, [])

  async function createControl(emailNormalized: string) {
      const wsId = await createWorkspaceByControlCode(controlCode, emailNormalized, {
        months,
        currentMonthId,
        ui,
        templates,
      })
      setSyncWorkspaceMeta({ ownerEmail: emailNormalized, allowedEmails: [emailNormalized] })
      setSyncWorkspaceId(wsId)
      setPendingJoinRequestId(null)
  }

  async function joinControl(emailNormalized: string) {
    const { workspaceId, meta } = await joinWorkspaceByControlCode(controlCode, emailNormalized)
    setSyncWorkspaceMeta({
      ownerEmail: meta.ownerEmail,
      allowedEmails: [...new Set(meta.allowedEmails)].sort(),
    })
    setSyncWorkspaceId(workspaceId)
    setPendingJoinRequestId(null)
  }

  /** Depois de autenticar no fluxo «Primeiro acesso»: entra no controle ou cria se o código ainda não existir. */
  async function joinOrCreateAfterFirstAccess(emailNormalized: string) {
    try {
      await joinControl(emailNormalized)
    } catch (e) {
      const m = e instanceof Error ? e.message : ''
      if (/controle não encontrado/i.test(m)) {
        await createControl(emailNormalized)
      } else {
        throw e
      }
    }
  }

  async function handleSubmit() {
    setMsg(null)
    setBusy(true)
    setSyncWorkspaceId(null)
    const emailNormalized = email.trim().toLowerCase()
    const sessionEmail = authUser?.email?.trim().toLowerCase() ?? null
    try {
      // Sessão já é deste email: não chamar signUp/signIn (corrige vários POST signUp no DevTools).
      if (sessionEmail === emailNormalized) {
        if (mode === 'login') {
          await joinControl(emailNormalized)
        } else {
          await joinOrCreateAfterFirstAccess(emailNormalized)
        }
      } else {
        if (sessionEmail && sessionEmail !== emailNormalized) {
          await signOutUser()
        }
        if (mode === 'login') {
          await signInWithPassword(emailNormalized, password)
          await joinControl(emailNormalized)
        } else {
          try {
            await registerWithPassword(emailNormalized, password)
          } catch (e) {
            if (isEmailAlreadyInUse(e)) {
              await signInWithPassword(emailNormalized, password)
            } else {
              throw e
            }
          }
          await joinOrCreateAfterFirstAccess(emailNormalized)
        }
      }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(PLANIZE_LAST_CONTROL_CODE_KEY, controlCode.trim())
        window.localStorage.setItem(PLANIZE_LAST_LOGIN_EMAIL_KEY, emailNormalized)
        window.sessionStorage.setItem(PLANIZE_POST_LOGIN_WELCOME_KEY, '1')
      }
    } catch (e) {
      setMsg(authErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const title = mode === 'login' ? 'Entrar na sua conta' : 'Criar nova conta'
  const subtitle =
    mode === 'login'
      ? 'Use e-mail, senha e código para entrar no seu controle.'
      : 'Cadastre-se e conecte ao controle no mesmo passo.'

  const onSubmit = () => {
    if (busy) return
    void handleSubmit()
  }

  return (
    <div
      className={`font-sans min-h-[100dvh] flex items-center justify-center px-5 pt-[env(safe-area-inset-top)] pb-[max(1.5rem,env(safe-area-inset-bottom))] ${
        theme === 'light'
          ? 'bg-gradient-to-br from-indigo-50 via-blue-50 to-violet-100 text-slate-900'
          : 'bg-gradient-to-br from-[#0f0c29] via-[#1a1560] to-[#24243e] text-white'
      }`}
    >
      <div className={`w-full max-w-sm rounded-2xl border p-5 shadow-xl ${theme === 'light' ? 'border-slate-200 bg-white/90' : 'border-white/15 bg-white/10'}`}>
        <div className="mb-4 flex items-center gap-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${theme === 'light' ? 'bg-primary/10' : 'bg-black/25'}`}>
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-lg font-extrabold leading-none text-primary">Planize</p>
            <p className="mt-1 text-xs text-muted">Acesse com e-mail e senha</p>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-border bg-card/40 p-1">
          <button
            type="button"
            onClick={() => { setMode('login'); setMsg(null) }}
            className={`rounded-lg py-2 text-xs font-semibold transition ${
              mode === 'login' ? 'bg-primary text-white' : 'text-muted hover:text-textMain'
            }`}
          >
            Já tenho conta
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setMsg(null) }}
            className={`rounded-lg py-2 text-xs font-semibold transition ${
              mode === 'register' ? 'bg-primary text-white' : 'text-muted hover:text-textMain'
            }`}
          >
            Primeiro acesso
          </button>
        </div>

        <div className="mb-3">
          <p className="text-sm font-semibold text-textMain">{title}</p>
          <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
          {authUser?.email?.trim() ? (
            <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] leading-snug text-amber-200 light:text-amber-900">
              {email.trim().toLowerCase() === authUser.email!.trim().toLowerCase()
                ? 'Sessão já iniciada com este email. Confirme o código e use «Entrar no controle» — não chama criar conta outra vez.'
                : `Sessão ativa com ${authUser.email}. Use o mesmo email no campo em cima (ou saia da conta nas definições) antes de continuar.`}
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-medium text-muted">
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setMsg(null) }}
              placeholder="joao@test.com"
              onKeyDown={e => e.key === 'Enter' && onSubmit()}
              className={`mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2 ${
                theme === 'light' ? 'border-slate-200 bg-white text-slate-900' : 'border-white/15 bg-black/20 text-white placeholder:text-white/40'
              }`}
            />
          </label>
          <label className="block text-xs font-medium text-muted">
            Código do controle
            <div className="relative mt-1.5">
              <input
                type="text"
                autoComplete="off"
                value={controlCode}
                onChange={e => { setControlCode(e.target.value); setMsg(null) }}
                placeholder="ex.: 12345"
                onKeyDown={e => e.key === 'Enter' && onSubmit()}
                className={`w-full rounded-xl border px-3 py-2.5 pl-9 text-sm outline-none ring-primary focus:ring-2 ${
                  theme === 'light' ? 'border-slate-200 bg-white text-slate-900' : 'border-white/15 bg-black/20 text-white placeholder:text-white/40'
                }`}
              />
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            </div>
          </label>
          <label className="block text-xs font-medium text-muted">
            Senha
            <div className="relative mt-1.5">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setMsg(null) }}
                placeholder="mínimo 6 caracteres"
                onKeyDown={e => e.key === 'Enter' && onSubmit()}
                className={`w-full rounded-xl border px-3 py-2.5 pr-10 text-sm outline-none ring-primary focus:ring-2 ${
                  theme === 'light' ? 'border-slate-200 bg-white text-slate-900' : 'border-white/15 bg-black/20 text-white placeholder:text-white/40'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-textMain"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>
        </div>

        <p className="mt-3 text-[11px] leading-snug text-muted">
          Após entrar com sucesso, o email e o código do controle ficam guardados neste aparelho para a próxima vez.
        </p>

        <div className="mt-4">
          <button
            type="button"
            disabled={busy || (mode === 'login' ? !canLogin : !canRegister)}
            onClick={onSubmit}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {mode === 'login' ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {busy
              ? 'Aguarde...'
              : mode === 'login'
                ? 'Entrar no controle'
                : 'Criar conta e entrar'}
          </button>
        </div>

        {msg ? <p className="mt-3 text-xs text-amber-300 light:text-amber-700">{msg}</p> : null}
        {!msg ? <p className="mt-3 text-xs text-muted">No primeiro acesso, se o código não existir ainda, ele será criado automaticamente.</p> : null}
      </div>
    </div>
  )
}
