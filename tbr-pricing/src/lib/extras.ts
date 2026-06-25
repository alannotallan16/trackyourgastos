import type { AppConfig } from '../config/types'
import type { AppliedExtra } from '../engine/pricing'
import { extraAmount } from '../engine/pricing'

// UI-side state for the extras section, shared by both tools.

export interface ExtraItemState {
  on: boolean
  /** Per-quote amount in region currency (defaults to the region's configured value). */
  amount: number
}

export interface ExtrasModel {
  items: ExtraItemState[] // aligned 1:1 with config.extras
  specialDiscountOn: boolean
  /** User-typed positive amount; applied as a subtraction. */
  specialDiscountAmount: number
}

/** Build an extras model with region defaults, all toggled off. */
export function initExtras(config: AppConfig, regionCode: string): ExtrasModel {
  return {
    items: config.extras.map((e) => ({ on: false, amount: extraAmount(e, regionCode) })),
    specialDiscountOn: false,
    specialDiscountAmount: 0,
  }
}

/** Re-pull every (untouched) default amount when the region changes. */
export function repriceExtras(config: AppConfig, regionCode: string, model: ExtrasModel): ExtrasModel {
  return {
    ...model,
    items: config.extras.map((e, i) => ({
      on: model.items[i]?.on ?? false,
      amount: extraAmount(e, regionCode),
    })),
  }
}

/** Resolve the model into the applied line items the engine consumes. */
export function resolveExtras(config: AppConfig, isCPA: boolean, model: ExtrasModel): AppliedExtra[] {
  const out: AppliedExtra[] = []
  config.extras.forEach((extra, i) => {
    const state = model.items[i]
    if (!state?.on) return
    // Non-CPA discounts only apply when the employee is NOT a CPA.
    if (extra.type === 'nonCpaDiscount' && isCPA) return
    out.push({ name: extra.name, applied: state.amount })
  })
  if (model.specialDiscountOn && model.specialDiscountAmount > 0) {
    out.push({ name: 'Special Discount', applied: -Math.abs(model.specialDiscountAmount) })
  }
  return out
}

export function extrasTotal(config: AppConfig, isCPA: boolean, model: ExtrasModel): number {
  return resolveExtras(config, isCPA, model).reduce((s, e) => s + e.applied, 0)
}
