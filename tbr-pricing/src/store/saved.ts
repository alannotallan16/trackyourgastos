import { useCallback, useEffect, useState } from 'react'
import { uid } from '../lib/id'

// Generic localStorage-backed collection of named, saved items.
// Used for both Quotes (Salary Calculator) and Recommendations (HR).

export interface SavedRecord<T> {
  id: string
  name: string
  savedAt: string
  data: T
}

function read<T>(key: string): SavedRecord<T>[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as SavedRecord<T>[]) : []
  } catch {
    return []
  }
}

function write<T>(key: string, records: SavedRecord<T>[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(records))
  } catch {
    // ignore
  }
}

export function useSaved<T>(key: string) {
  const [records, setRecords] = useState<SavedRecord<T>[]>(() => read<T>(key))

  useEffect(() => {
    write(key, records)
  }, [key, records])

  const save = useCallback((name: string, data: T): SavedRecord<T> => {
    const rec: SavedRecord<T> = { id: uid(), name, savedAt: new Date().toISOString(), data }
    setRecords((prev) => [rec, ...prev])
    return rec
  }, [])

  const remove = useCallback((id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id))
  }, [])

  return { records, save, remove }
}
