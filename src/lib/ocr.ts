/**
 * Light-weight parsers for OCR'd receipt text. Best-effort extraction of
 * date / merchant / total. The form pre-fills these and the user reviews.
 */

export interface ExtractedReceipt {
  date: string | null;        // ISO yyyy-mm-dd
  merchant: string | null;
  total: number | null;
  rawText: string;
}

const TOTAL_KEYWORDS = ["total amount", "grand total", "amount due", "total due", "total"];
const DATE_REGEXES: RegExp[] = [
  /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/,           // 2026-05-12
  /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/,         // 12/05/2026 or 12-05-26
  /\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})\b/        // 12 May 2026
];
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12
};

function pad(n: number) { return String(n).padStart(2, "0"); }

function tryDate(text: string): string | null {
  for (const re of DATE_REGEXES) {
    const m = text.match(re);
    if (!m) continue;
    if (re === DATE_REGEXES[0]) {
      const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
      if (y && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${y}-${pad(mo)}-${pad(d)}`;
    } else if (re === DATE_REGEXES[1]) {
      let a = Number(m[1]); let b = Number(m[2]); let y = Number(m[3]);
      if (y < 100) y += 2000;
      // assume dd/mm/yyyy by default (PH common); if a>12, swap
      let d = a, mo = b;
      if (a > 12 && b <= 12) { d = a; mo = b; }
      else if (b > 12 && a <= 12) { d = b; mo = a; }
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${y}-${pad(mo)}-${pad(d)}`;
    } else {
      const d = Number(m[1]); const mo = MONTHS[m[2].toLowerCase()]; let y = Number(m[3]);
      if (y < 100) y += 2000;
      if (mo && d >= 1 && d <= 31) return `${y}-${pad(mo)}-${pad(d)}`;
    }
  }
  return null;
}

function tryTotal(text: string): number | null {
  const lines = text.split(/\r?\n/);
  let best: number | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    if (!TOTAL_KEYWORDS.some((k) => line.includes(k))) continue;
    // Find a number on this or the next line.
    const candidates = `${lines[i]} ${lines[i + 1] ?? ""}`.match(/-?\d{1,3}(?:[,\s]\d{3})*(?:\.\d{1,2})?/g);
    if (!candidates) continue;
    const nums = candidates.map((s) => Number(s.replace(/[,\s]/g, "")));
    const max = nums.filter((n) => !Number.isNaN(n)).sort((a, b) => b - a)[0];
    if (max && (best === null || max > best)) best = max;
  }
  if (best != null) return best;

  // Fallback: largest number with 2 decimals in the text.
  const all = text.match(/\d{1,3}(?:[,\s]\d{3})*\.\d{2}/g);
  if (!all) return null;
  const nums = all.map((s) => Number(s.replace(/[,\s]/g, ""))).filter((n) => !Number.isNaN(n) && n < 1_000_000);
  if (nums.length === 0) return null;
  nums.sort((a, b) => b - a);
  return nums[0];
}

function tryMerchant(text: string): string | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  // Common: top line of receipt is the merchant name (skip very short or numeric-only)
  for (const l of lines.slice(0, 6)) {
    if (l.length < 3) continue;
    if (/^[\d\s,.\-/]+$/.test(l)) continue;
    if (/receipt|invoice|tin|vat|cashier|or\s*#/i.test(l)) continue;
    return l.replace(/\s{2,}/g, " ").slice(0, 80);
  }
  return null;
}

export function parseReceiptText(text: string): ExtractedReceipt {
  return {
    date: tryDate(text),
    merchant: tryMerchant(text),
    total: tryTotal(text),
    rawText: text
  };
}
