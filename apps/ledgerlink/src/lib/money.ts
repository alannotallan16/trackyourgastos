/**
 * Money is represented in application code as an integer number of **minor
 * units** (centavos for PHP). We never do arithmetic on floating-point pesos.
 * Values coming from Postgres NUMERIC arrive as strings and are parsed here.
 *
 * Rounding rule: round half up to the currency's minor unit.
 */

export type Centavos = number;

const CURRENCY_SYMBOLS: Record<string, string> = {
  PHP: "₱",
  USD: "$",
  SGD: "S$",
  EUR: "€",
};

/** Parse a decimal amount (number or NUMERIC string) into integer centavos. */
export function toCentavos(input: number | string | null | undefined): Centavos {
  if (input === null || input === undefined || input === "") return 0;
  const s = (typeof input === "number" ? input.toString() : input).trim();
  const neg = s.startsWith("-");
  const cleaned = s.replace(/[^0-9.]/g, "");
  const [intPart = "0", fracRaw = ""] = cleaned.split(".");
  const frac = (fracRaw + "000").slice(0, 3); // keep 3 digits so we can round the 3rd
  const whole = BigInt(intPart || "0") * 100n;
  const cents = BigInt(frac.slice(0, 2) || "0");
  const third = Number(frac[2] ?? "0");
  let total = whole + cents;
  if (third >= 5) total += 1n; // round half up
  const res = Number(total);
  return neg ? -res : res;
}

/** Centavos -> decimal number (for display/serialization only). */
export function fromCentavos(c: Centavos): number {
  return Math.round(c) / 100;
}

/** Centavos -> NUMERIC string with 2 decimals (safe for DB writes). */
export function toDecimalString(c: Centavos): string {
  const neg = c < 0;
  const abs = Math.abs(Math.round(c));
  const s = `${Math.floor(abs / 100)}.${(abs % 100).toString().padStart(2, "0")}`;
  return neg ? `-${s}` : s;
}

/** Human-readable currency string, e.g. "₱23,658.87". */
export function formatMoney(
  c: Centavos,
  currency = "PHP",
  opts: { sign?: boolean } = {},
): string {
  const neg = c < 0;
  const abs = Math.abs(Math.round(c)) / 100;
  const body = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sym = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  const prefix = neg ? "-" : opts.sign ? "+" : "";
  return `${prefix}${sym}${body}`;
}

export function sumCentavos(values: Centavos[]): Centavos {
  return values.reduce((a, b) => a + b, 0);
}

/** Distribute a total across n parts as evenly as possible; last absorbs remainder. */
export function distribute(totalC: Centavos, n: number): Centavos[] {
  if (n <= 0) return [];
  const base = Math.floor(totalC / n);
  const parts = Array<number>(n).fill(base);
  let remainder = totalC - base * n;
  // Spread the leftover centavos onto the first rows for a stable, reconciling split.
  for (let i = 0; i < remainder; i++) parts[i] += 1;
  return parts;
}
