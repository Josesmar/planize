import { useCallback, useState } from 'react'
import { TrendingUp, Shield, BarChart3, ArrowRight, Wallet } from 'lucide-react'
import { useStore } from '../store'

export default function LandingPage() {
  const completeOnboarding = useStore(s => s.completeOnboarding)
  const theme = useStore(s => s.ui?.theme ?? 'dark')
  const [loading, setLoading] = useState(false)
  const [workspaceTitle, setWorkspaceTitle] = useState('')
  const [count, setCount] = useState(2)
  const [names, setNames] = useState<string[]>(() =>
    Array.from({ length: 2 }, (_, i) => `Pessoa ${i + 1}`)
  )

  const adjustNamesForCount = useCallback((n: number) => {
    setNames(prev => {
      const next = prev.slice(0, n)
      while (next.length < n) next.push(`Pessoa ${next.length + 1}`)
      return next
    })
  }, [])

  const handleCountChange = (n: number) => {
    setCount(n)
    adjustNamesForCount(n)
  }

  const handleSubmit = () => {
    setLoading(true)
    completeOnboarding({
      workspaceTitle: workspaceTitle.trim() || 'Planize',
      incomeSlotCount: count,
      personLabels: names.slice(0, count),
    })
  }

  return (
    <div className={`font-sans min-h-[100dvh] flex flex-col items-center justify-center px-6 pt-[env(safe-area-inset-top)] pb-[max(1.5rem,env(safe-area-inset-bottom))] ${
      theme === 'light'
        ? 'bg-gradient-to-br from-indigo-50 via-blue-50 to-violet-100 text-slate-900'
        : 'bg-gradient-to-br from-[#0f0c29] via-[#1a1560] to-[#24243e] text-white'
    }`}>
      <div className={`mb-6 flex items-center justify-center w-20 h-20 rounded-2xl shadow-lg backdrop-blur-sm border ${theme === 'light' ? 'bg-primary/10 border-primary/20' : 'bg-white/10 border-white/20'}`}>
        <Wallet className="w-10 h-10 text-primary" />
      </div>

      <h1 className={`text-4xl font-extrabold tracking-tight text-center mb-2 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
        <span className="text-primary">Planize</span>
      </h1>
      <p className={`text-center text-sm mb-8 max-w-sm ${theme === 'light' ? 'text-slate-500' : 'text-white/60'}`}>
        Configure quantas pessoas entram na renda e os nomes nas colunas. Você pode mudar depois em Ajustes.
      </p>

      <div className={`w-full max-w-sm space-y-4 mb-8 rounded-2xl border p-4 ${theme === 'light' ? 'border-slate-200 bg-white/80' : 'border-white/10 bg-white/5'}`}>
        <label className="block text-xs font-medium text-muted">
          Título do espaço (opcional)
          <input
            type="text"
            value={workspaceTitle}
            onChange={e => setWorkspaceTitle(e.target.value)}
            placeholder="Ex.: Casa, Eu só…"
            className={`mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2 ${
              theme === 'light' ? 'border-slate-200 bg-white text-slate-900' : 'border-white/15 bg-black/20 text-white placeholder:text-white/40'
            }`}
          />
        </label>
        <label className="block text-xs font-medium text-muted">
          Quantas pessoas na renda?
          <select
            value={count}
            onChange={e => handleCountChange(Number(e.target.value))}
            className={`mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2 ${
              theme === 'light' ? 'border-slate-200 bg-white text-slate-900' : 'border-white/15 bg-black/20 text-white'
            }`}
          >
            {[1, 2, 3, 4, 5, 6].map(n => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'pessoa' : 'pessoas'}
              </option>
            ))}
          </select>
        </label>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted">Nomes nas colunas</p>
          {names.slice(0, count).map((name, i) => (
            <input
              key={i}
              type="text"
              value={name}
              onChange={e => {
                const next = [...names]
                next[i] = e.target.value
                setNames(next)
              }}
              placeholder={`Pessoa ${i + 1}`}
              className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ring-primary focus:ring-2 ${
                theme === 'light' ? 'border-slate-200 bg-white text-slate-900' : 'border-white/15 bg-black/20 text-white placeholder:text-white/40'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="w-full max-w-sm space-y-3 mb-10">
        <Feature icon={<TrendingUp className="w-5 h-5 text-primary" />} text="Visão completa das suas finanças" theme={theme} />
        <Feature icon={<BarChart3 className="w-5 h-5 text-primary" />} text="Métricas e gráficos mensais" theme={theme} />
        <Feature icon={<Shield className="w-5 h-5 text-primary" />} text="Dados salvos no aparelho; nuvem opcional" theme={theme} />
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading}
        className="flex items-center gap-2 bg-primary hover:bg-primary/90 active:scale-95 transition-all text-white font-semibold py-4 px-8 rounded-2xl shadow-lg text-base disabled:opacity-70"
      >
        {loading ? 'Abrindo…' : 'Entrar no Planize'}
        {!loading && <ArrowRight className="w-5 h-5" />}
      </button>

      <p className={`mt-8 text-xs text-center ${theme === 'light' ? 'text-slate-400' : 'text-white/30'}`}>
        Grátis · Login por conta · Funciona offline
      </p>
    </div>
  )
}

function Feature({ icon, text, theme }: { icon: React.ReactNode; text: string; theme: string }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
      theme === 'light'
        ? 'bg-white/70 border-slate-200 text-slate-700'
        : 'bg-white/5 border-white/10 text-white/80'
    }`}>
      {icon}
      <span className="text-sm">{text}</span>
    </div>
  )
}
