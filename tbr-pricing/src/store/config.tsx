import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppConfig } from '../config/types'
import { DEFAULT_CONFIG } from '../config/defaults'

const STORAGE_KEY = 'tbr-pricing.config.v1'

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

function loadConfig(): AppConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return clone(DEFAULT_CONFIG)
    const parsed = JSON.parse(raw)
    // Shallow merge over defaults so newly-added default keys are not lost.
    return { ...clone(DEFAULT_CONFIG), ...parsed }
  } catch {
    return clone(DEFAULT_CONFIG)
  }
}

interface ConfigContextValue {
  config: AppConfig
  setConfig: (next: AppConfig) => void
  resetConfig: () => void
}

const ConfigContext = createContext<ConfigContextValue | null>(null)

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<AppConfig>(() => loadConfig())

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    } catch {
      // ignore quota / private-mode errors
    }
  }, [config])

  const setConfig = useCallback((next: AppConfig) => setConfigState(next), [])
  const resetConfig = useCallback(() => setConfigState(clone(DEFAULT_CONFIG)), [])

  const value = useMemo(() => ({ config, setConfig, resetConfig }), [config, setConfig, resetConfig])
  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>
}

export function useConfig(): ConfigContextValue {
  const ctx = useContext(ConfigContext)
  if (!ctx) throw new Error('useConfig must be used within ConfigProvider')
  return ctx
}

export { DEFAULT_CONFIG, clone }
