export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Safely parses a server timestamp into UTC milliseconds.
 * - Handles ISO strings with/without 'Z' (e.g. "2026-11-06T20:20:00.123456")
 * - Handles strings with space separator (e.g. "2026-11-06 20:20:00")
 * - Handles already-specified timezones (e.g. "+00:00", "+05:30", "Z")
 * - Avoids false matching trailing date hyphens (e.g. "2026-11-06")
 */
export function parseUtcDate(dateStr: string | null | undefined): number {
  if (!dateStr) return 0;
  const trimmed = dateStr.trim();
  if (!trimmed) return 0;

  // Replace space with T for cross-browser ISO compatibility
  const isoFormatted = trimmed.replace(' ', 'T');

  // Check if string already explicitly defines a timezone:
  // e.g. ends with 'Z'/'z' or has timezone offset (+HH:MM, -HH:MM) after the time
  const hasZ = isoFormatted.endsWith('Z') || isoFormatted.endsWith('z');
  const hasOffset = /[T\d{2}:\d{2}][+-]\d{2}(?::?\d{2})?$/.test(isoFormatted);

  const normalized = hasZ || hasOffset ? isoFormatted : `${isoFormatted}Z`;
  const ts = new Date(normalized).getTime();
  return isNaN(ts) ? 0 : ts;
}

export default cn;
