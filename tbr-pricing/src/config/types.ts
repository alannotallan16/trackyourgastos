// Configuration model for the TBR pricing engine.
// Everything that drives a price lives here so non-developers can edit it
// through the Settings page (persisted to localStorage / Export-Import JSON).

export interface Statutory {
  deMinimis: number
  sssRate: number
  sssMaxMSC: number
  sssEC: number
  philhealthRate: number
  philhealthFloor: number
  philhealthCeiling: number
  pagibig: number
  hmo: number
  fcfRate: number
  feeRounding: number
  thirteenthDivisor: number
}

export interface Region {
  symbol: string
  exchRate: number
  bpo: number
  benefits: number
  it: number
  factor: number
  cpd: number
}

export type ExtraType = 'add' | 'nonCpaDiscount'

export interface Extra {
  name: string
  type: ExtraType
  // Per-region amounts, keyed by region code.
  [regionCode: string]: number | string
}

export interface Role {
  category: string
  role: string
  gross: number
}

export type Shifts = Record<string, number>

export interface AppConfig {
  statutory: Statutory
  shifts: Shifts
  regions: Record<string, Region>
  extras: Extra[]
  roles: Role[]
}
