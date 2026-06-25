import { useEffect, useMemo, useState } from 'react'
import { useConfig } from '../store/config'
import { useSaved } from '../store/saved'
import { computePrice } from '../engine/pricing'
import { groupRoles, findRole } from '../lib/roles'
import { initExtras, repriceExtras, resolveExtras } from '../lib/extras'
import type { ExtrasModel } from '../lib/extras'
import { formatRegion, formatPHP, formatPct, formatSignedRegion } from '../lib/format'
import { Card, Field, TextInput, Select, Button, Toggle, Stat, Pill } from '../components/ui'
import { ExtrasEditor } from '../components/ExtrasEditor'
import { uid } from '../lib/id'

interface RecRow {
  id: string
  /** Which field is the source of truth. */
  mode: 'pct' | 'gross'
  pct: number
  gross: number
}

interface RecState {
  clientName: string
  employeeName: string
  regionCode: string
  roleName: string
  shift: string
  isCPA: boolean
  effectivity: string
  hoursPerWeek: number
  currentGross: number
  currentBill: number
  extras: ExtrasModel
  rows: RecRow[]
  option1Id: string | null
  option2Id: string | null
}

const PRELOAD_PCTS = [5, 8, 10, 12, 15]

function makeRows(currentGross: number): RecRow[] {
  const rows = PRELOAD_PCTS.map((p) => ({
    id: uid(),
    mode: 'pct' as const,
    pct: p,
    gross: Math.round(currentGross * (1 + p / 100)),
  }))
  // two blank rows
  rows.push({ id: uid(), mode: 'pct', pct: 0, gross: currentGross })
  rows.push({ id: uid(), mode: 'pct', pct: 0, gross: currentGross })
  return rows
}

export function Recommendation() {
  const { config } = useConfig()
  const regionCodes = Object.keys(config.regions)
  const shiftNames = Object.keys(config.shifts)
  const groups = useMemo(() => groupRoles(config), [config])
  const saved = useSaved<RecState>('tbr-pricing.recommendations.v1')

  const firstRole = config.roles[0]
  const initialGross = firstRole?.gross ?? 50000
  const [s, setS] = useState<RecState>(() => ({
    clientName: '',
    employeeName: '',
    regionCode: regionCodes[0],
    roleName: firstRole?.role ?? '',
    shift: shiftNames[0] ?? 'Day',
    isCPA: false,
    effectivity: '',
    hoursPerWeek: 40,
    currentGross: initialGross,
    currentBill: 0,
    extras: initExtras(config, regionCodes[0]),
    rows: makeRows(initialGross),
    option1Id: null,
    option2Id: null,
  }))

  useEffect(() => {
    setS((prev) => ({ ...prev, extras: repriceExtras(config, prev.regionCode, prev.extras) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.regionCode])

  const applied = useMemo(() => resolveExtras(config, s.isCPA, s.extras), [config, s.isCPA, s.extras])

  const onSelectRole = (roleName: string) => {
    const r = findRole(config, roleName)
    setS((prev) => ({ ...prev, roleName, currentGross: r?.gross ?? prev.currentGross }))
  }

  // Compute metrics for a given gross.
  const metricsFor = (gross: number) => {
    const r = computePrice(config, {
      gross,
      regionCode: s.regionCode,
      isCPA: s.isCPA,
      shift: s.shift,
      hoursPerWeek: s.hoursPerWeek,
      extras: applied,
    })
    const increasePHP = gross - s.currentGross
    const increasePct = s.currentGross > 0 ? increasePHP / s.currentGross : 0
    const variance = r.fee - s.currentBill
    return { result: r, increasePHP, increasePct, variance, gross }
  }

  const setRow = (id: string, patch: Partial<RecRow>) => {
    setS((prev) => ({
      ...prev,
      rows: prev.rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    }))
  }

  const onRowPct = (id: string, pct: number) => {
    setRow(id, { mode: 'pct', pct, gross: Math.round(s.currentGross * (1 + pct / 100)) })
  }
  const onRowGross = (id: string, gross: number) => {
    const pct = s.currentGross > 0 ? (gross / s.currentGross - 1) * 100 : 0
    setRow(id, { mode: 'gross', gross, pct: Math.round(pct * 100) / 100 })
  }

  const addRow = () =>
    setS((prev) => ({ ...prev, rows: [...prev.rows, { id: uid(), mode: 'pct', pct: 0, gross: prev.currentGross }] }))
  const removeRow = (id: string) =>
    setS((prev) => ({
      ...prev,
      rows: prev.rows.filter((r) => r.id !== id),
      option1Id: prev.option1Id === id ? null : prev.option1Id,
      option2Id: prev.option2Id === id ? null : prev.option2Id,
    }))

  const setOption = (slot: 1 | 2, id: string) =>
    setS((prev) => {
      if (slot === 1) return { ...prev, option1Id: prev.option1Id === id ? null : id }
      return { ...prev, option2Id: prev.option2Id === id ? null : id }
    })

  // Re-derive row grosses when currentGross changes (only for pct-mode rows).
  useEffect(() => {
    setS((prev) => ({
      ...prev,
      rows: prev.rows.map((r) =>
        r.mode === 'pct' ? { ...r, gross: Math.round(prev.currentGross * (1 + r.pct / 100)) } : r,
      ),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.currentGross])

  const option1 = s.rows.find((r) => r.id === s.option1Id)
  const option2 = s.rows.find((r) => r.id === s.option2Id)
  const options = [
    { label: 'Option 1', row: option1 },
    { label: 'Option 2', row: option2 },
  ].filter((o) => o.row) as { label: string; row: RecRow }[]

  const onSave = () => {
    const name = window.prompt('Save recommendation as:', s.employeeName || s.clientName || 'Untitled recommendation')
    if (name) saved.save(name, s)
  }

  const sym = config.regions[s.regionCode]?.symbol ?? ''

  return (
    <div className="space-y-6">
      <Card
        title="Recommendation details"
        subtitle="Propose a fee change when an employee's salary moves"
        actions={
          <Button variant="secondary" onClick={onSave} className="no-print">
            Save
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Client">
            <TextInput value={s.clientName} onChange={(e) => setS({ ...s, clientName: e.target.value })} />
          </Field>
          <Field label="Employee">
            <TextInput value={s.employeeName} onChange={(e) => setS({ ...s, employeeName: e.target.value })} />
          </Field>
          <Field label="Effectivity date">
            <TextInput type="date" value={s.effectivity} onChange={(e) => setS({ ...s, effectivity: e.target.value })} />
          </Field>
          <Field label="Region">
            <Select value={s.regionCode} onChange={(e) => setS({ ...s, regionCode: e.target.value })}>
              {regionCodes.map((rc) => (
                <option key={rc} value={rc}>
                  {rc} ({config.regions[rc].symbol})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Role / Level">
            <Select value={s.roleName} onChange={(e) => onSelectRole(e.target.value)}>
              {groups.map((g) => (
                <optgroup key={g.category} label={g.category}>
                  {g.roles.map((r) => (
                    <option key={r.role} value={r.role}>
                      {r.role}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
          <Field label="Shift">
            <Select value={s.shift} onChange={(e) => setS({ ...s, shift: e.target.value })}>
              {shiftNames.map((sh) => (
                <option key={sh} value={sh}>
                  {sh} ({(config.shifts[sh] * 100).toFixed(1)}%)
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Billable hours / week">
            <TextInput
              type="number"
              value={s.hoursPerWeek}
              onChange={(e) => setS({ ...s, hoursPerWeek: Number(e.target.value) })}
            />
          </Field>
          <Field label="Current gross (PHP)">
            <TextInput
              type="number"
              value={s.currentGross}
              onChange={(e) => setS({ ...s, currentGross: Number(e.target.value) })}
            />
          </Field>
          <Field label={`Current bill (${sym})`} hint="The fee the client pays today (manual)">
            <TextInput
              type="number"
              value={s.currentBill}
              onChange={(e) => setS({ ...s, currentBill: Number(e.target.value) })}
            />
          </Field>
          <div className="flex items-end">
            <div className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
              <span className="text-sm font-medium text-slate-700">CPA</span>
              <Toggle checked={s.isCPA} onChange={(v) => setS({ ...s, isCPA: v })} label="CPA" />
            </div>
          </div>
        </div>
      </Card>

      <Card
        title="Options workspace"
        subtitle="Enter a % increase (gross auto-fills) or a direct gross. Mark two rows as Option 1 / Option 2."
        actions={
          <Button variant="secondary" onClick={addRow} className="no-print">
            Add row
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-2 py-2 font-medium">% Increase</th>
                <th className="px-2 py-2 font-medium">Proposed gross</th>
                <th className="px-2 py-2 font-medium text-right">Salary ↑ (PHP)</th>
                <th className="px-2 py-2 font-medium text-right">Salary ↑ (%)</th>
                <th className="px-2 py-2 font-medium text-right">Billed PHP</th>
                <th className="px-2 py-2 font-medium text-right">Recommended fee</th>
                <th className="px-2 py-2 font-medium text-right">Variance</th>
                <th className="px-2 py-2 font-medium text-right">Hourly</th>
                <th className="px-2 py-2 font-medium text-center no-print">Options</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {s.rows.map((row) => {
                const m = metricsFor(row.gross)
                const isOpt1 = s.option1Id === row.id
                const isOpt2 = s.option2Id === row.id
                return (
                  <tr key={row.id} className={isOpt1 || isOpt2 ? 'bg-brand-50/50' : ''}>
                    <td className="px-2 py-1.5">
                      <TextInput
                        type="number"
                        value={row.pct}
                        onChange={(e) => onRowPct(row.id, Number(e.target.value))}
                        className="w-20"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <TextInput
                        type="number"
                        value={row.gross}
                        onChange={(e) => onRowGross(row.id, Number(e.target.value))}
                        className="w-28"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right font-medium text-slate-700">{formatPHP(m.increasePHP)}</td>
                    <td className="px-2 py-1.5 text-right text-slate-500">{formatPct(m.increasePct)}</td>
                    <td className="px-2 py-1.5 text-right text-slate-500">{formatPHP(m.result.billedPHP)}</td>
                    <td className="px-2 py-1.5 text-right font-semibold text-slate-900">
                      {formatRegion(config, s.regionCode, m.result.fee)}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <span className={m.variance >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                        {formatSignedRegion(config, s.regionCode, m.variance)}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right text-slate-500">
                      {formatRegion(config, s.regionCode, m.result.hourly, { decimals: 2 })}
                    </td>
                    <td className="px-2 py-1.5 no-print">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setOption(1, row.id)}
                          className={`rounded px-2 py-1 text-xs font-medium ${
                            isOpt1 ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          1
                        </button>
                        <button
                          onClick={() => setOption(2, row.id)}
                          className={`rounded px-2 py-1 text-xs font-medium ${
                            isOpt2 ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          2
                        </button>
                        <button
                          onClick={() => removeRow(row.id)}
                          className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                          title="Remove row"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Variance is the recommended fee minus the current bill ({formatRegion(config, s.regionCode, s.currentBill)}).
        </p>
      </Card>

      {/* Two options side by side */}
      {options.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {options.map(({ label, row }) => {
            const m = metricsFor(row.gross)
            return (
              <Card key={label} title={label} subtitle={`From ${formatPHP(s.currentGross)} → ${formatPHP(row.gross)}`}>
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Recommended fee" value={formatRegion(config, s.regionCode, m.result.fee)} emphasis />
                  <Stat
                    label="Variance vs current"
                    value={formatSignedRegion(config, s.regionCode, m.variance)}
                    sub={`Current ${formatRegion(config, s.regionCode, s.currentBill)}`}
                  />
                  <Stat label="Salary increase" value={formatPHP(m.increasePHP)} sub={formatPct(m.increasePct)} />
                  <Stat label="Hourly" value={formatRegion(config, s.regionCode, m.result.hourly, { decimals: 2 })} />
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Client summary block (printable) */}
      {options.length > 0 && (
        <Card
          title="Client summary"
          subtitle="Printable recommendation summary"
          actions={
            <Button variant="secondary" onClick={() => window.print()} className="no-print">
              Print / PDF
            </Button>
          }
        >
          <div className="mb-3 text-sm text-slate-600">
            {s.clientName && (
              <span className="mr-3">
                <span className="text-slate-400">Client:</span> {s.clientName}
              </span>
            )}
            {s.employeeName && (
              <span className="mr-3">
                <span className="text-slate-400">Employee:</span> {s.employeeName}
              </span>
            )}
            {s.effectivity && (
              <span>
                <span className="text-slate-400">Effective:</span> {s.effectivity}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-2 py-2 font-medium">Option</th>
                  <th className="px-2 py-2 font-medium">Name</th>
                  <th className="px-2 py-2 font-medium">Shift</th>
                  <th className="px-2 py-2 font-medium text-right">Current bill</th>
                  <th className="px-2 py-2 font-medium text-right">Recommendation</th>
                  <th className="px-2 py-2 font-medium text-right">Variance</th>
                  <th className="px-2 py-2 font-medium">Effectivity</th>
                  <th className="px-2 py-2 font-medium text-right">Increase (PHP)</th>
                  <th className="px-2 py-2 font-medium text-right">From</th>
                  <th className="px-2 py-2 font-medium text-right">To</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {options.map(({ label, row }) => {
                  const m = metricsFor(row.gross)
                  return (
                    <tr key={label}>
                      <td className="px-2 py-2">
                        <Pill tone="brand">{label}</Pill>
                      </td>
                      <td className="px-2 py-2 text-slate-700">{s.employeeName || '—'}</td>
                      <td className="px-2 py-2 text-slate-700">{s.shift}</td>
                      <td className="px-2 py-2 text-right text-slate-700">
                        {formatRegion(config, s.regionCode, s.currentBill)}
                      </td>
                      <td className="px-2 py-2 text-right font-semibold text-slate-900">
                        {formatRegion(config, s.regionCode, m.result.fee)}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <span className={m.variance >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                          {formatSignedRegion(config, s.regionCode, m.variance)}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-slate-700">{s.effectivity || '—'}</td>
                      <td className="px-2 py-2 text-right text-slate-700">{formatPHP(m.increasePHP)}</td>
                      <td className="px-2 py-2 text-right text-slate-500">{formatPHP(s.currentGross)}</td>
                      <td className="px-2 py-2 text-right text-slate-700">{formatPHP(row.gross)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title="Extras &amp; discounts" subtitle="Applied to every option" className="no-print">
        <ExtrasEditor
          config={config}
          regionCode={s.regionCode}
          isCPA={s.isCPA}
          model={s.extras}
          onChange={(extras) => setS({ ...s, extras })}
        />
      </Card>

      {saved.records.length > 0 && (
        <Card title="Saved recommendations" className="no-print">
          <ul className="space-y-2">
            {saved.records.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
                <button className="min-w-0 flex-1 text-left" onClick={() => setS(r.data)}>
                  <div className="truncate text-sm font-medium text-slate-800">{r.name}</div>
                  <div className="text-xs text-slate-400">{new Date(r.savedAt).toLocaleString()}</div>
                </button>
                <Button variant="danger" onClick={() => saved.remove(r.id)}>
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
