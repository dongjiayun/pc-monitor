/**
 * Format a number to 2 decimal places
 */
export function f2(value: number | undefined | null, fallback = '0.00'): string {
  if (value === undefined || value === null) return fallback
  return Number(value).toFixed(2)
}

/**
 * Smart format: show integer if whole, otherwise show with decimals
 */
export function f(value: number | undefined | null, fallback = '0'): string {
  if (value === undefined || value === null) return fallback
  const n = Number(value)
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)
}

/**
 * Format percentage with 2 decimal places
 */
export function pct(value: number | undefined | null): string {
  return f2(value) + '%'
}

/**
 * Format temperature with 2 decimal places
 */
export function temp(value: number | undefined | null): string {
  return f2(value) + '°C'
}
