/**
 * Date and timezone utility functions.
 * Ensures consistent UTC parsing and clean local browser time formatting.
 */

/**
 * Safely parse any ISO timestamp as UTC.
 * Normalizes any ISO string lacking 'Z' or a timezone offset (+/-HH:MM)
 * by appending 'Z' before calling new Date().
 */
export function parseUTC(isoString: string | null | undefined): Date {
  if (!isoString) return new Date();
  let s = String(isoString).trim();
  if (!s.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(s)) {
    s = s + 'Z';
  }
  return new Date(s);
}

/**
 * Format timestamp cleanly for users:
 * Primary: Local browser time, e.g. "10:46:35 AM IST, 17 Nov"
 * Secondary: UTC reference, e.g. "2026-11-17 05:16:35 UTC"
 */
export function formatDisplayTime(isoString?: string | null): { local: string; utc: string } {
  if (!isoString) return { local: '—', utc: '—' };
  const d = parseUTC(isoString);
  if (isNaN(d.getTime())) return { local: '—', utc: '—' };

  try {
    const timeFormatted = new Intl.DateTimeFormat('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    }).format(d).toUpperCase();

    const dateFormatted = new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
    }).format(d);

    const local = `${timeFormatted}, ${dateFormatted}`;
    const utc = d.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    return { local, utc };
  } catch {
    const local = d.toLocaleString();
    const utc = d.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    return { local, utc };
  }
}
