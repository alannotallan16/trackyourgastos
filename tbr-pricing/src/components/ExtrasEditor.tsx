import type { AppConfig } from '../config/types'
import type { ExtrasModel } from '../lib/extras'
import { Toggle, TextInput } from './ui'

export function ExtrasEditor({
  config,
  regionCode,
  isCPA,
  model,
  onChange,
}: {
  config: AppConfig
  regionCode: string
  isCPA: boolean
  model: ExtrasModel
  onChange: (next: ExtrasModel) => void
}) {
  const symbol = config.regions[regionCode]?.symbol ?? ''

  const setItem = (i: number, patch: Partial<ExtrasModel['items'][number]>) => {
    const items = model.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it))
    onChange({ ...model, items })
  }

  return (
    <div className="space-y-2">
      {config.extras.map((extra, i) => {
        const state = model.items[i]
        const disabled = extra.type === 'nonCpaDiscount' && isCPA
        return (
          <div
            key={extra.name}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
              state?.on && !disabled ? 'border-brand-200 bg-brand-50/40' : 'border-slate-200'
            } ${disabled ? 'opacity-50' : ''}`}
          >
            <Toggle
              checked={!!state?.on && !disabled}
              onChange={(v) => setItem(i, { on: v })}
              label={extra.name}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-slate-700">{extra.name}</div>
              {disabled && <div className="text-xs text-slate-400">Not applicable — employee is a CPA</div>}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-400">{symbol}</span>
              <TextInput
                type="number"
                value={Number.isFinite(state?.amount) ? state.amount : 0}
                onChange={(e) => setItem(i, { amount: Number(e.target.value) })}
                className="w-24 text-right"
                disabled={disabled}
              />
            </div>
          </div>
        )
      })}

      {/* Special Discount — user-typed positive amount, subtracted when on */}
      <div
        className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
          model.specialDiscountOn ? 'border-red-200 bg-red-50/40' : 'border-slate-200'
        }`}
      >
        <Toggle
          checked={model.specialDiscountOn}
          onChange={(v) => onChange({ ...model, specialDiscountOn: v })}
          label="Special Discount"
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-slate-700">Special Discount</div>
          <div className="text-xs text-slate-400">Subtracted from the fee</div>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-400">−{symbol}</span>
          <TextInput
            type="number"
            min={0}
            value={model.specialDiscountAmount || 0}
            onChange={(e) => onChange({ ...model, specialDiscountAmount: Math.abs(Number(e.target.value)) })}
            className="w-24 text-right"
          />
        </div>
      </div>
    </div>
  )
}
