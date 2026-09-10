/**
 * FT-number normalization for extended/compound identifiers printed on some
 * bank documents, e.g. "FT24AB123456\BNK" — the actual FT reference is the
 * part before the last separator ("FT24AB123456"); everything after it is a
 * suffix that must be ignored. Separators seen in the wild: "\", "/" and "|"
 * (OCR frequently misreads "\" as one of the others) — none of them can occur
 * inside a real FT reference (FT + 10 alphanumeric chars), so cutting there is
 * always safe.
 */
export function normalizeFtNumber(ft?: string | null): string | undefined {
  if (!ft) return undefined;
  const trimmed = String(ft).trim().toUpperCase();
  if (!trimmed) return undefined;
  const lastSeparator = Math.max(
    trimmed.lastIndexOf('\\'),
    trimmed.lastIndexOf('/'),
    trimmed.lastIndexOf('|'),
  );
  const base = lastSeparator >= 0 ? trimmed.slice(0, lastSeparator) : trimmed;
  const clean = base.trim();
  return clean || undefined;
}
