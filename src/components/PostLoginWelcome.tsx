import { useEffect, useMemo, useState } from 'react'
import { Sparkles, Wallet } from 'lucide-react'
import { PLANIZE_POST_LOGIN_WELCOME_KEY } from '../constants/storageKeys'
import { useStore } from '../store'
import { readGreetingNameFromDevice } from '../utils/greetingNameStorage'

type Props = {
  onFinish: () => void
}

/**
 * Após cada login com Firebase: ecrã de boas-vindas com o nome guardado em `ui.greetingName`.
 * O pedido de nome («Olá, como posso te chamar?») só aparece uma vez, enquanto `greetingName` estiver vazio.
 */
export default function PostLoginWelcome({ onFinish }: Props) {
  const theme = useStore(s => s.ui?.theme ?? 'dark')
  const savedName = useStore(s => s.ui?.greetingName ?? '')
  const updateUi = useStore(s => s.updateUi)
  const setActiveTab = useStore(s => s.setActiveTab)

  const hasSavedName = useMemo(() => Boolean(savedName.trim()), [savedName])
  const [step, setStep] = useState<'ask' | 'welcome'>(() => (hasSavedName ? 'welcome' : 'ask'))
  const [nameInput, setNameInput] = useState(savedName.trim())

  /** Reidratação / Firestore podem atrasar; localStorage tem o nome de imediato após refresh. */
  useEffect(() => {
    const fromLs = readGreetingNameFromDevice()
    const fromStore = useStore.getState().ui?.greetingName?.trim() ?? ''
    const effective = fromStore || fromLs
    if (!effective) return
    if (!fromStore && fromLs) useStore.getState().updateUi({ greetingName: fromLs })
    setNameInput(effective)
    setStep('welcome')
  }, [])

  useEffect(() => {
    if (savedName.trim() && step === 'ask') setStep('welcome')
  }, [savedName, step])

  function submitName() {
    const n = nameInput.trim()
    if (!n) return
    updateUi({ greetingName: n })
    setNameInput(n)
    setStep('welcome')
  }

  function goToApp() {
    setActiveTab('planilha')
    updateUi({ onboardingDone: true })
    try {
      sessionStorage.removeItem(PLANIZE_POST_LOGIN_WELCOME_KEY)
    } catch {
      /* ignore */
    }
    onFinish()
  }

  const shell =
    theme === 'light'
      ? 'bg-gradient-to-br from-indigo-50 via-blue-50 to-violet-100 text-slate-900'
      : 'bg-gradient-to-br from-[#0f0c29] via-[#1a1560] to-[#24243e] text-white'

  const card =
    theme === 'light' ? 'border-slate-200 bg-white/90' : 'border-white/15 bg-white/10'

  /** Nome para a saudação: preferir store (já guardado), senão o que acabou de ser digitado. */
  const welcomeName = (savedName.trim() || nameInput.trim())

  return (
    <div
      className={`font-sans min-h-[100dvh] flex items-center justify-center px-5 pt-[env(safe-area-inset-top)] pb-[max(1.5rem,env(safe-area-inset-bottom))] ${shell}`}
    >
      <div className={`w-full max-w-sm rounded-2xl border p-6 shadow-xl ${card}`}>
        <div className="mb-5 flex items-center gap-3">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl ${theme === 'light' ? 'bg-primary/10' : 'bg-black/25'}`}
          >
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-lg font-extrabold leading-none text-primary">Planize</p>
            <p className="mt-1 text-xs text-muted">Bem-vindo</p>
          </div>
        </div>

        {step === 'ask' ? (
          <div className="space-y-4">
            <p className="text-center text-base font-semibold leading-snug text-textMain">
              Olá, como posso te chamar?
            </p>
            <label className="block text-xs font-medium text-muted">
              Seu nome
              <input
                type="text"
                autoComplete="name"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                placeholder="Digite como prefere ser chamado(a)"
                onKeyDown={e => e.key === 'Enter' && nameInput.trim() && submitName()}
                className={`mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2 ${
                  theme === 'light'
                    ? 'border-slate-200 bg-white text-slate-900'
                    : 'border-white/15 bg-black/20 text-white placeholder:text-white/40'
                }`}
              />
            </label>
            <button
              type="button"
              disabled={!nameInput.trim()}
              onClick={() => submitName()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Continuar
            </button>
          </div>
        ) : (
          <div className="space-y-5 text-center">
            <div
              className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${theme === 'light' ? 'bg-primary/15' : 'bg-primary/20'}`}
            >
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <div className="space-y-1.5">
              <p className="text-lg font-semibold leading-snug text-textMain">
                {welcomeName ? (
                  <>
                    Seja bem vindo(a), <span className="text-primary">{welcomeName}</span>!
                  </>
                ) : (
                  'Seja bem vindo(a)!'
                )}
              </p>
              <p className="text-sm text-muted">ao Planize</p>
            </div>
            <button
              type="button"
              onClick={() => goToApp()}
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white"
            >
              Ir para a planilha
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
