export type CalendarEvent = {
  id: string;
  title: string;
  startDate: Date;
  location?: string;
  description?: string;
};

function unfoldIcs(text: string) {
  // RFC5545 line folding: CRLF + (space|tab) means continuation.
  return text.replace(/\r?\n[ \t]/g, '');
}

function parseIcsDate(value: string): Date | null {
  const v = value.trim();
  // All-day: YYYYMMDD
  if (/^\d{8}$/.test(v)) {
    const y = Number(v.slice(0, 4));
    const m = Number(v.slice(4, 6));
    const d = Number(v.slice(6, 8));
    // 09:00 local to avoid midnight/timezone surprises
    return new Date(y, m - 1, d, 9, 0, 0);
  }

  // Date-time: YYYYMMDDTHHMMSS(Z optional)
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const hh = Number(m[4]);
  const mm = Number(m[5]);
  const ss = Number(m[6]);
  const isUtc = Boolean(m[7]);
  return isUtc ? new Date(Date.UTC(y, mo - 1, d, hh, mm, ss)) : new Date(y, mo - 1, d, hh, mm, ss);
}

function pickField(lines: string[], key: string): string | undefined {
  // Match "KEY:" or "KEY;PARAM=...:"
  const re = new RegExp(`^${key}(;[^:]*)?:`, 'i');
  const line = lines.find((l) => re.test(l));
  if (!line) return undefined;
  const idx = line.indexOf(':');
  if (idx < 0) return undefined;
  return line.slice(idx + 1).trim();
}

export function parseIcsEvents(icsText: string): CalendarEvent[] {
  const unfolded = unfoldIcs(icsText);
  const lines = unfolded.split(/\r?\n/).map((l) => l.trimEnd());

  const events: CalendarEvent[] = [];
  let cur: string[] | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      cur = [];
      continue;
    }
    if (line === 'END:VEVENT') {
      if (cur) {
        const uid = pickField(cur, 'UID');
        const title = pickField(cur, 'SUMMARY') ?? 'Evento';
        const dtStartRaw = pickField(cur, 'DTSTART');
        const startDate = dtStartRaw ? parseIcsDate(dtStartRaw) : null;
        if (startDate) {
          const location = pickField(cur, 'LOCATION');
          const description = pickField(cur, 'DESCRIPTION');
          const id = uid ?? `${title}_${startDate.toISOString()}`;
          events.push({ id, title, startDate, location, description });
        }
      }
      cur = null;
      continue;
    }
    if (cur) cur.push(line);
  }

  return events;
}

export async function fetchIcs(url: string, options: { timeoutMs?: number } = {}): Promise<string> {
  const timeoutMs = options.timeoutMs ?? 15000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

