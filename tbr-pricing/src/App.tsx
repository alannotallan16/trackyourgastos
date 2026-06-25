import { useState } from 'react'
import { Calculator } from './pages/Calculator'
import { Recommendation } from './pages/Recommendation'
import { Settings } from './pages/Settings'

type Tab = 'calculator' | 'recommendation' | 'settings'

const TABS: { id: Tab; label: string; short: string }[] = [
  { id: 'calculator', label: 'Salary Calculator', short: 'Calculator' },
  { id: 'recommendation', label: 'Salary Recommendation', short: 'Recommend' },
  { id: 'settings', label: 'Settings', short: 'Settings' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('calculator')

  return (
    <div className="min-h-full">
      <header className="no-print sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              TBR
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-slate-900">The Back Room — Pricing</div>
              <div className="text-xs text-slate-500">Salary calculator &amp; fee recommendations</div>
            </div>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-px">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative whitespace-nowrap px-4 py-2.5 text-sm font-medium transition ${
                tab === t.id
                  ? 'text-brand-700'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.short}</span>
              {tab === t.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {tab === 'calculator' && <Calculator />}
        {tab === 'recommendation' && <Recommendation />}
        {tab === 'settings' && <Settings />}
      </main>

      <footer className="no-print mx-auto max-w-6xl px-4 pb-10 pt-4 text-center text-xs text-slate-400">
        The Back Room · Offshore staffing pricing · Rates are editable in Settings
      </footer>
    </div>
  )
}
