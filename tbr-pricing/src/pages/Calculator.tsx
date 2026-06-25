import { useEffect, useMemo, useState } from 'react'
import { useConfig } from '../store/config'
import { useSaved } from '../store/saved'
import { computePrice, publishedScaleFee } from '../engine/pricing'
import { groupRoles, findRole } from '../lib/roles'
import { initExtras, repriceExtras, resolveExtras } from '../lib/extras'
import type { ExtrasModel } from '../lib/extras'
import { formatRegion, formatPHP, formatSignedRegion } from '../lib/format'
import { Card, Field, TextInput, Select, Button, Toggle, Stat, Pill } from '../components/ui'
import { ExtrasEditor } from '../components/ExtrasEditor'

interface QuoteState {
  clientName: string
  employeeName: string
  regionCode: string
  roleName: string
  gross: number
  shift: string
  isCPA: boolean
  hoursPerWeek: number
  extras: ExtrasModel
}

export function Calculator() {
  const { config } = useConfig()
  const regionCodes = Object.keys(config.regions)
  const shiftNames = Object.keys(config.shifts)
  const groups = useMemo(() => groupRoles(config), [config])
  const saved = useSaved<QuoteState>('tbr-pricing.quotes.v1')

  const firstRole = config.roles[0]
  const [q, setQ] = useState<QuoteState>(() => ({
    clientName: '',
    employeeName: '',
    regionCode: regionCodes[0],
    roleName: firstRole?.role ?? '',
    gross: firstRole?.gross ?? 0,
    shift: shiftNames[0] ?? 'Day',
    isCPA: false,
    hoursPerWeek: 40,
    extras: initExtras(config, regionCodes[0]),
  }))

  const role = findRole(config, q.roleName)
  const scaleGross = role?.gross ?? 0

  // When the region changes, re-pull default extra amounts.
  useEffect(() => {
    setQ((prev) => ({ ...prev, extras: repriceExtras(config, prev.regionCode, prev.extras) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.regionCode])

  const applied = useMemo(
    () => resolveExtras(config, q.isCPA, q.extras),
    [config, q.isCPA, q.extras],
  )

  const result = useMemo(
    () =>
      computePrice(config, {
        gross: q.gross,
        regionCode: q.regionCode,
        isCPA: q.isCPA,
        shift: q.shift,
        hoursPerWeek: q.hoursPerWeek,
        extras: applied,
      }),
    [config, q, applied],
  )

  // Scale reference (scale gross, no shift/extras/cpa) for comparison.
  const scaleResult = useMemo(
    () =>
      computePrice(config, {
        gross: scaleGross,
        regionCode: q.regionCode,
        isCPA: false,
        shift: 'Day',
        hoursPerWeek: q.hoursPerWeek,
        extras: [],
      }),
    [config, scaleGross, q.regionCode, q.hoursPerWeek],
  )

  const scaleFee = publishedScaleFee(config, scaleGross, q.regionCode)
  // Knowledge & Expertise adjustment = billed(negotiated) − billed(scale).
  const keAdjustment = result.billedPHP - scaleResult.billedPHP

  const onSelectRole = (roleName: string) => {
    const r = findRole(config, roleName)
    setQ((prev) => ({ ...prev, roleName, gross: r?.gross ?? prev.gross }))
  }

  const sym = config.regions[q.regionCode]?.symbol ?? ''

  const onSave = () => {
    const name = window.prompt('Save quote as:', q.employeeName || q.clientName || 'Untitled quote')
    if (name) saved.save(name, q)
  }

  const lineItems: { label: string; value: number; muted?: boolean }[] = [
    { label: 'Salary (billed PHP → currency)', value: result.salaryForeign },
    { label: 'FCF (3%)', value: result.fcf },
    { label: 'BPO', value: result.bpo },
    { label: 'Benefits', value: result.benefits },
    { label: 'IT', value: result.it },
  ]
  if (q.isCPA) lineItems.push({ label: 'CPD (CPA)', value: result.cpd })
  lineItems.push({ label: 'Shift premium', value: result.shiftForeign })

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      {/* Inputs */}
      <div className="space-y-6 lg:col-span-3">
        <Card
          title="Quote details"
          subtitle="Per-employee monthly client fee"
          actions={
            <Button variant="secondary" onClick={onSave} className="no-print">
              Save quote
            </Button>
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Client name">
              <TextInput
                value={q.clientName}
                onChange={(e) => setQ({ ...q, clientName: e.target.value })}
                placeholder="e.g. Acme Ltd"
              />
            </Field>
            <Field label="Employee name">
              <TextInput
                value={q.employeeName}
                onChange={(e) => setQ({ ...q, employeeName: e.target.value })}
                placeholder="e.g. Juan dela Cruz"
              />
            </Field>
            <Field label="Region">
              <Select value={q.regionCode} onChange={(e) => setQ({ ...q, regionCode: e.target.value })}>
                {regionCodes.map((rc) => (
                  <option key={rc} value={rc}>
                    {rc} ({config.regions[rc].symbol})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Role / Level">
              <Select value={q.roleName} onChange={(e) => onSelectRole(e.target.value)}>
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
            <Field label="Negotiated gross (PHP)" hint={`Scale gross: ${formatPHP(scaleGross)}`}>
              <TextInput
                type="number"
                value={q.gross}
                onChange={(e) => setQ({ ...q, gross: Number(e.target.value) })}
              />
            </Field>
            <Field label="Billable hours / week">
              <TextInput
                type="number"
                value={q.hoursPerWeek}
                onChange={(e) => setQ({ ...q, hoursPerWeek: Number(e.target.value) })}
              />
            </Field>
            <Field label="Shift">
              <Select value={q.shift} onChange={(e) => setQ({ ...q, shift: e.target.value })}>
                {shiftNames.map((s) => (
                  <option key={s} value={s}>
                    {s} ({(config.shifts[s] * 100).toFixed(1)}%)
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end">
              <div className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                <span className="text-sm font-medium text-slate-700">CPA</span>
                <Toggle checked={q.isCPA} onChange={(v) => setQ({ ...q, isCPA: v })} label="CPA" />
              </div>
            </div>
          </div>
        </Card>

        <Card title="Reference — scale pricing" subtitle="Headline numbers for this role / region">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Scale gross" value={formatPHP(scaleGross)} />
            <Stat label="Scale billed (PHP)" value={formatPHP(scaleResult.billedPHP)} />
            <Stat label="Published scale fee" value={formatRegion(config, q.regionCode, scaleFee)} />
          </div>
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600">Knowledge &amp; Expertise adjustment</span>
              <Pill tone={keAdjustment === 0 ? 'slate' : keAdjustment > 0 ? 'brand' : 'red'}>
                {keAdjustment >= 0 ? '+' : ''}
                {formatPHP(keAdjustment)} billed PHP
              </Pill>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Effect of the negotiated gross vs. scale (billed PHP at negotiated − billed PHP at scale).
            </p>
          </div>
        </Card>

        <Card title="Extras" subtitle="Toggle add-ons; amounts auto-pull by region and are editable per quote">
          <ExtrasEditor
            config={config}
            regionCode={q.regionCode}
            isCPA={q.isCPA}
            model={q.extras}
            onChange={(extras) => setQ({ ...q, extras })}
          />
        </Card>
      </div>

      {/* Output */}
      <div className="space-y-6 lg:col-span-2">
        <Card
          className="lg:sticky lg:top-32"
          title="Monthly billed fee"
          subtitle={`${q.regionCode} · ${q.shift} shift${q.isCPA ? ' · CPA' : ''}`}
          actions={
            <Button variant="secondary" onClick={() => window.print()} className="no-print">
              Print / PDF
            </Button>
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Monthly billed fee" value={formatRegion(config, q.regionCode, result.fee)} emphasis />
            <Stat label="Hourly rate" value={formatRegion(config, q.regionCode, result.hourly, { decimals: 2 })} emphasis />
          </div>

          <div className="mt-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Breakdown</div>
            <dl className="divide-y divide-slate-100 text-sm">
              {lineItems.map((li) => (
                <div key={li.label} className="flex items-center justify-between py-1.5">
                  <dt className="text-slate-600">{li.label}</dt>
                  <dd className="font-medium text-slate-900">
                    {formatRegion(config, q.regionCode, li.value, { decimals: 2 })}
                  </dd>
                </div>
              ))}
              <div className="flex items-center justify-between py-1.5">
                <dt className="font-medium text-slate-700">Core (rounded to {config.statutory.feeRounding})</dt>
                <dd className="font-semibold text-slate-900">
                  {formatRegion(config, q.regionCode, result.coreRounded)}
                </dd>
              </div>
            </dl>
          </div>

          {applied.length > 0 && (
            <div className="mt-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Extras</div>
              <dl className="divide-y divide-slate-100 text-sm">
                {applied.map((e) => (
                  <div key={e.name} className="flex items-center justify-between py-1.5">
                    <dt className="text-slate-600">{e.name}</dt>
                    <dd className={`font-medium ${e.applied < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                      {formatSignedRegion(config, q.regionCode, e.applied)}
                    </dd>
                  </div>
                ))}
                <div className="flex items-center justify-between py-1.5">
                  <dt className="font-medium text-slate-700">Extras total</dt>
                  <dd className="font-semibold text-slate-900">
                    {formatSignedRegion(config, q.regionCode, result.extrasTotal)}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          <div className="mt-4 rounded-xl bg-brand-600 px-4 py-3 text-white">
            <div className="flex items-center justify-between">
              <span className="text-sm">Monthly billed fee</span>
              <span className="text-xl font-bold">{formatRegion(config, q.regionCode, result.fee)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-brand-100">
              <span className="text-xs">Billed PHP (statutory)</span>
              <span className="text-xs">{formatPHP(result.billedPHP)}</span>
            </div>
          </div>

          {(q.clientName || q.employeeName) && (
            <div className="mt-3 text-xs text-slate-500">
              {q.clientName && <div>Client: {q.clientName}</div>}
              {q.employeeName && <div>Employee: {q.employeeName}</div>}
            </div>
          )}
          <div className="mt-1 text-xs text-slate-400">
            Pay rate vs scale: {formatSignedRegion(config, q.regionCode, result.coreRounded - scaleFee)} on core
            {sym ? '' : ''}
          </div>
        </Card>

        {saved.records.length > 0 && (
          <Card title="Saved quotes" className="no-print">
            <ul className="space-y-2">
              {saved.records.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setQ(r.data)}
                    title="Load quote"
                  >
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
    </div>
  )
}
