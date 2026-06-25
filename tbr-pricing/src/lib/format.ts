import type { AppConfig } from '../config/types'

/** Format an amount with the region's currency symbol. */
export function formatRegion(
  config: AppConfig,
  regionCode: string,
  amount: number,
  opts: { decimals?: number } = {},
): string {
  const symbol = config.regions[regionCode]?.symbol ?? ''
  const decimals = opts.decimals ?? 0
  return `${symbol}${formatNumber(amount, decimals)}`
}

/** Format a PHP peso amount. */
export function formatPHP(amount: number, decimals = 0): string {
  return `₱${formatNumber(amount, decimals)}`
}

export function formatNumber(amount: number, decimals = 0): string {
  if (!isFinite(amount)) return '—'
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function formatPct(fraction: number, decimals = 1): string {
  if (!isFinite(fraction)) return '—'
  return `${(fraction * 100).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`
}

/** Signed format, e.g. "+NZ$120" / "-NZ$50". */
export function formatSignedRegion(config: AppConfig, regionCode: string, amount: number, decimals = 0): string {
  const sign = amount >= 0 ? '+' : '-'
  return `${sign}${formatRegion(config, regionCode, Math.abs(amount), { decimals })}`
}
