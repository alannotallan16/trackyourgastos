import { useRef, useState } from 'react'
import { useConfig, clone } from '../store/config'
import type { AppConfig, Region, Statutory } from '../config/types'
import { Card, Field, TextInput, Button, Select } from '../components/ui'

export function Settings() {
  const { config, setConfig, resetConfig } = useConfig()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const update = (mut: (draft: AppConfig) => void) => {
    const draft = clone(config)
    mut(draft)
    setConfig(draft)
  }

  const regionCodes = Object.keys(config.regions)

  const onExport = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tbr-pricing-config-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const onImport = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result))
        if (!parsed.statutory || !parsed.regions || !parsed.extras || !parsed.roles) {
          throw new Error('Missing required sections (statutory, regions, extras, roles).')
        }
        setConfig(parsed as AppConfig)
        setImportMsg({ ok: true, text: 'Config imported successfully.' })
      } catch (err) {
        setImportMsg({ ok: false, text: `Import failed: ${(err as Error).message}` })
      }
    }
    reader.readAsText(file)
  }

  const onReset = () => {
    if (window.confirm('Reset all rates and roles to defaults? This cannot be undone.')) {
      resetConfig()
      setImportMsg({ ok: true, text: 'Reset to defaults.' })
    }
  }

  const statutoryFields: { key: keyof Statutory; label: string; step?: number }[] = [
    { key: 'deMinimis', label: 'De Minimis' },
    { key: 'sssRate', label: 'SSS rate', step: 0.01 },
    { key: 'sssMaxMSC', label: 'SSS max MSC' },
    { key: 'sssEC', label: 'SSS EC' },
    { key: 'philhealthRate', label: 'PhilHealth rate', step: 0.001 },
    { key: 'philhealthFloor', label: 'PhilHealth floor' },
    { key: 'philhealthCeiling', label: 'PhilHealth ceiling' },
    { key: 'pagibig', label: 'Pag-IBIG' },
    { key: 'hmo', label: 'HMO' },
    { key: 'fcfRate', label: 'FCF rate', step: 0.01 },
    { key: 'feeRounding', label: 'Fee rounding' },
    { key: 'thirteenthDivisor', label: '13th divisor' },
  ]

  const regionFields: { key: keyof Region; label: string; step?: number }[] = [
    { key: 'symbol', label: 'Symbol' },
    { key: 'exchRate', label: 'Exch rate' },
    { key: 'bpo', label: 'BPO' },
    { key: 'benefits', label: 'Benefits' },
    { key: 'it', label: 'IT' },
    { key: 'factor', label: 'Factor', step: 0.001 },
    { key: 'cpd', label: 'CPD' },
  ]

  return (
    <div className="space-y-6">
      <Card
        title="Configuration"
        subtitle="Edit rates and roles. Changes save automatically to this browser."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onExport}>
              Export JSON
            </Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              Import JSON
            </Button>
            <Button variant="danger" onClick={onReset}>
              Reset to defaults
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onImport(f)
                e.target.value = ''
              }}
            />
          </div>
        }
      >
        {importMsg && (
          <div
            className={`rounded-lg px-3 py-2 text-sm ${
              importMsg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {importMsg.text}
          </div>
        )}
        {!importMsg && (
          <p className="text-sm text-slate-500">
            Non-developers can update rates here without touching code. Export to back up or share; Import to load a saved
            config.
          </p>
        )}
      </Card>

      {/* Statutory */}
      <Card title="Statutory parameters" subtitle="Philippine-peso build-up rates">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {statutoryFields.map((f) => (
            <Field key={f.key} label={f.label}>
              <TextInput
                type="number"
                step={f.step ?? 1}
                value={config.statutory[f.key]}
                onChange={(e) =>
                  update((d) => {
                    d.statutory[f.key] = Number(e.target.value)
                  })
                }
              />
            </Field>
          ))}
        </div>
      </Card>

      {/* Shifts */}
      <Card title="Shift premiums" subtitle="Percentage of gross added per shift">
        <div className="space-y-2">
          {Object.entries(config.shifts).map(([name, pct]) => (
            <div key={name} className="flex items-center gap-3">
              <TextInput
                value={name}
                onChange={(e) =>
                  update((d) => {
                    const v = d.shifts[name]
                    delete d.shifts[name]
                    d.shifts[e.target.value] = v
                  })
                }
                className="w-40"
              />
              <TextInput
                type="number"
                step={0.001}
                value={pct}
                onChange={(e) =>
                  update((d) => {
                    d.shifts[name] = Number(e.target.value)
                  })
                }
                className="w-32"
              />
              <span className="text-sm text-slate-400">{(pct * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Regions */}
      <Card title="Regions" subtitle="Currency, exchange rate and per-region costs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-2 py-2 font-medium">Region</th>
                {regionFields.map((f) => (
                  <th key={f.key} className="px-2 py-2 font-medium">
                    {f.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {regionCodes.map((rc) => (
                <tr key={rc}>
                  <td className="px-2 py-1.5 font-semibold text-slate-700">{rc}</td>
                  {regionFields.map((f) => (
                    <td key={f.key} className="px-2 py-1.5">
                      <TextInput
                        type={f.key === 'symbol' ? 'text' : 'number'}
                        step={f.step ?? 1}
                        value={config.regions[rc][f.key] as number | string}
                        onChange={(e) =>
                          update((d) => {
                            const val = f.key === 'symbol' ? e.target.value : Number(e.target.value)
                            // @ts-expect-error indexed assignment across union
                            d.regions[rc][f.key] = val
                          })
                        }
                        className="w-24"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Extras */}
      <Card title="Extras" subtitle="Per-region add-ons and discounts">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-2 py-2 font-medium">Name</th>
                <th className="px-2 py-2 font-medium">Type</th>
                {regionCodes.map((rc) => (
                  <th key={rc} className="px-2 py-2 font-medium text-right">
                    {rc}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {config.extras.map((extra, i) => (
                <tr key={i}>
                  <td className="px-2 py-1.5">
                    <TextInput
                      value={extra.name}
                      onChange={(e) =>
                        update((d) => {
                          d.extras[i].name = e.target.value
                        })
                      }
                      className="w-56"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Select
                      value={extra.type}
                      onChange={(e) =>
                        update((d) => {
                          d.extras[i].type = e.target.value as 'add' | 'nonCpaDiscount'
                        })
                      }
                      className="w-36"
                    >
                      <option value="add">add</option>
                      <option value="nonCpaDiscount">nonCpaDiscount</option>
                    </Select>
                  </td>
                  {regionCodes.map((rc) => (
                    <td key={rc} className="px-2 py-1.5">
                      <TextInput
                        type="number"
                        value={(extra[rc] as number) ?? 0}
                        onChange={(e) =>
                          update((d) => {
                            d.extras[i][rc] = Number(e.target.value)
                          })
                        }
                        className="w-20 text-right"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Roles */}
      <Card
        title="Roles"
        subtitle={`${config.roles.length} roles`}
        actions={
          <Button
            variant="secondary"
            onClick={() =>
              update((d) => {
                d.roles.push({ category: 'New', role: 'New role', gross: 50000 })
              })
            }
          >
            Add role
          </Button>
        }
      >
        <div className="max-h-[28rem] overflow-y-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-2 py-2 font-medium">Category</th>
                <th className="px-2 py-2 font-medium">Role</th>
                <th className="px-2 py-2 font-medium text-right">Gross (PHP)</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {config.roles.map((r, i) => (
                <tr key={i}>
                  <td className="px-2 py-1.5">
                    <TextInput
                      value={r.category}
                      onChange={(e) =>
                        update((d) => {
                          d.roles[i].category = e.target.value
                        })
                      }
                      className="w-44"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <TextInput
                      value={r.role}
                      onChange={(e) =>
                        update((d) => {
                          d.roles[i].role = e.target.value
                        })
                      }
                      className="w-full min-w-[14rem]"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <TextInput
                      type="number"
                      value={r.gross}
                      onChange={(e) =>
                        update((d) => {
                          d.roles[i].gross = Number(e.target.value)
                        })
                      }
                      className="w-28 text-right"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <button
                      onClick={() =>
                        update((d) => {
                          d.roles.splice(i, 1)
                        })
                      }
                      className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
