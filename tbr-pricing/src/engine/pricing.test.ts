import { describe, it, expect } from 'vitest'
import { DEFAULT_CONFIG } from '../config/defaults'
import { computePrice, mround, publishedScaleFee, billedPHPFor } from './pricing'

const cfg = DEFAULT_CONFIG

function feeFor(gross: number, regionCode: string): number {
  return computePrice(cfg, {
    gross,
    regionCode,
    isCPA: false,
    shift: 'Day',
    hoursPerWeek: 40,
    extras: [],
  }).coreRounded
}

describe('mround', () => {
  it('rounds to the nearest multiple', () => {
    expect(mround(4105.71, 50)).toBe(4100)
    expect(mround(3129.56, 50)).toBe(3150)
    expect(mround(80000, 500)).toBe(80000)
    expect(mround(80250, 500)).toBe(80500) // .5 rounds up
  })
})

// Validation cases — non-CPA, Day shift, no extras.
// These reproduce the source spreadsheet; if they pass, the engine matches.
describe('engine validation cases', () => {
  const cases = [
    { role: 'Senior Accountant – L1', gross: 80000, billedPHP: 93771, NZD: 4100, USD: 3150 },
    { role: 'Bookkeeper – L2', gross: 50000, billedPHP: 60521, NZD: 3100, USD: 2400 },
    { role: 'Tax Manager', gross: 250000, billedPHP: 278530, NZD: 9700, USD: 7250 },
    { role: 'Senior Accounting Manager', gross: 140000, billedPHP: 159363, NZD: 6100, USD: 4600 },
  ]

  for (const c of cases) {
    describe(c.role, () => {
      it(`billedPHP = ${c.billedPHP}`, () => {
        expect(billedPHPFor(cfg, c.gross)).toBe(c.billedPHP)
      })
      it(`NZD fee = ${c.NZD}`, () => {
        expect(feeFor(c.gross, 'NZD')).toBe(c.NZD)
      })
      it(`USD fee = ${c.USD}`, () => {
        expect(feeFor(c.gross, 'USD')).toBe(c.USD)
      })
    })
  }

  it('roles in config match their expected gross', () => {
    for (const c of cases) {
      const role = cfg.roles.find((r) => r.role === c.role)
      expect(role, `role ${c.role} present`).toBeTruthy()
      expect(role!.gross).toBe(c.gross)
    }
  })
})

describe('publishedScaleFee', () => {
  it('equals coreRounded with no shift/extras/cpa', () => {
    expect(publishedScaleFee(cfg, 80000, 'NZD')).toBe(4100)
    expect(publishedScaleFee(cfg, 80000, 'USD')).toBe(3150)
  })
})

describe('shift premiums and extras', () => {
  it('Late shift adds a shift premium on top of scale', () => {
    const base = computePrice(cfg, { gross: 80000, regionCode: 'NZD', isCPA: false, shift: 'Day', hoursPerWeek: 40 })
    const late = computePrice(cfg, { gross: 80000, regionCode: 'NZD', isCPA: false, shift: 'Late', hoursPerWeek: 40 })
    expect(late.shiftForeign).toBeGreaterThan(0)
    // shiftForeign = G * 0.20 * factor / exchRate = 80000*0.2*1/34
    expect(late.shiftForeign).toBeCloseTo((80000 * 0.2 * 1) / 34, 6)
    expect(base.shiftForeign).toBe(0)
  })

  it('special discount subtracts from the fee', () => {
    const withDiscount = computePrice(cfg, {
      gross: 80000,
      regionCode: 'NZD',
      isCPA: false,
      shift: 'Day',
      hoursPerWeek: 40,
      extras: [{ name: 'Special Discount', applied: -100 }],
    })
    expect(withDiscount.fee).toBe(4100 - 100)
  })

  it('CPD only applies to CPAs', () => {
    const cfg2 = { ...cfg, regions: { ...cfg.regions, NZD: { ...cfg.regions.NZD, cpd: 200 } } }
    const cpa = computePrice(cfg2, { gross: 80000, regionCode: 'NZD', isCPA: true, shift: 'Day', hoursPerWeek: 40 })
    const nonCpa = computePrice(cfg2, { gross: 80000, regionCode: 'NZD', isCPA: false, shift: 'Day', hoursPerWeek: 40 })
    expect(cpa.cpd).toBe(200)
    expect(nonCpa.cpd).toBe(0)
  })

  it('hourly rate uses hoursPerWeek * 52 / 12', () => {
    const r = computePrice(cfg, { gross: 80000, regionCode: 'NZD', isCPA: false, shift: 'Day', hoursPerWeek: 40 })
    expect(r.hourly).toBeCloseTo(r.fee / ((40 * 52) / 12), 6)
  })
})
