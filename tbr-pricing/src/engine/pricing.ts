import type { AppConfig, Extra, Region } from '../config/types'

/** Round x to the nearest multiple of m. mround(x, m) = round(x / m) * m */
export function mround(x: number, m: number): number {
  if (m === 0) return x
  return Math.round(x / m) * m
}

/** A toggled extra line item, with the amount that will actually be applied. */
export interface AppliedExtra {
  name: string
  /** Amount in region currency that is added to the fee (can be negative). */
  applied: number
}

export interface PriceInput {
  gross: number
  regionCode: string
  isCPA: boolean
  shift: string
  hoursPerWeek: number
  /** Extras that are toggled on, with their (possibly edited) per-quote amounts. */
  extras?: AppliedExtra[]
}

export interface PriceResult {
  // Philippine-peso statutory build-up
  basic: number
  thirteenth: number
  sss: number
  philhealth: number
  pagibig: number
  hmo: number
  billedPHP: number

  // Region-currency build-up
  salaryForeign: number
  fcf: number
  cpd: number
  bpo: number
  benefits: number
  it: number
  core: number
  coreRounded: number
  shiftForeign: number
  extrasTotal: number
  fee: number
  hourly: number
}

/**
 * Compute the statutory PHP build-up and the final region-currency fee.
 * This mirrors the source spreadsheet exactly.
 */
export function computePrice(config: AppConfig, input: PriceInput): PriceResult {
  const s = config.statutory
  const region = config.regions[input.regionCode]
  if (!region) throw new Error(`Unknown region: ${input.regionCode}`)

  const G = input.gross
  const shiftPct = config.shifts[input.shift] ?? 0

  // --- PHP statutory build-up ---
  const basic = G - s.deMinimis
  const thirteenth = Math.round(basic / s.thirteenthDivisor)
  const sss = Math.round(Math.min(mround(G, 500), s.sssMaxMSC) * s.sssRate) + s.sssEC
  const philhealth = Math.round(
    Math.min(Math.max(basic, s.philhealthFloor), s.philhealthCeiling) * s.philhealthRate,
  )
  const pagibig = s.pagibig
  const hmo = s.hmo
  const billedPHP = G + thirteenth + sss + philhealth + pagibig + hmo

  // --- Region-currency build-up ---
  const salaryForeign = (billedPHP * region.factor) / region.exchRate
  const fcf = salaryForeign * s.fcfRate
  const cpd = input.isCPA ? region.cpd : 0
  const core = salaryForeign + fcf + region.bpo + region.benefits + region.it + cpd
  const coreRounded = mround(core, s.feeRounding)
  const shiftForeign = (G * shiftPct * region.factor) / region.exchRate

  const extrasTotal = (input.extras ?? []).reduce((sum, e) => sum + e.applied, 0)
  const fee = coreRounded + shiftForeign + extrasTotal
  const hoursPerMonth = (input.hoursPerWeek * 52) / 12
  const hourly = hoursPerMonth > 0 ? fee / hoursPerMonth : 0

  return {
    basic,
    thirteenth,
    sss,
    philhealth,
    pagibig,
    hmo,
    billedPHP,
    salaryForeign,
    fcf,
    cpd,
    bpo: region.bpo,
    benefits: region.benefits,
    it: region.it,
    core,
    coreRounded,
    shiftForeign,
    extrasTotal,
    fee,
    hourly,
  }
}

/**
 * A role's published scale fee = coreRounded with no shift, no extras, non-CPA.
 * This is the headline price per role/region.
 */
export function publishedScaleFee(config: AppConfig, gross: number, regionCode: string): number {
  return computePrice(config, {
    gross,
    regionCode,
    isCPA: false,
    shift: 'Day',
    hoursPerWeek: 40,
    extras: [],
  }).coreRounded
}

/** Convenience: billed PHP for a given gross (region-independent). */
export function billedPHPFor(config: AppConfig, gross: number): number {
  return computePrice(config, {
    gross,
    regionCode: Object.keys(config.regions)[0],
    isCPA: false,
    shift: 'Day',
    hoursPerWeek: 40,
    extras: [],
  }).billedPHP
}

/** Read the per-region default amount for an extra. */
export function extraAmount(extra: Extra, regionCode: string): number {
  const v = extra[regionCode]
  return typeof v === 'number' ? v : 0
}

export function regionExchange(region: Region): number {
  return region.exchRate
}
