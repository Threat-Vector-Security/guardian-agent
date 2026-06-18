import type { SecondBrainRoutineSchedule, SecondBrainRoutineWeekday } from './types.js';

const DAY_MS = 24 * 60 * 60 * 1000;

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function normalizeTimeZone(timeZone: string | undefined): string | undefined {
  const normalized = timeZone?.trim();
  if (!normalized) return undefined;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: normalized }).format(new Date(0));
    return normalized;
  } catch {
    return undefined;
  }
}

export function formatZonedDateTime(value: number, timeZone?: string): string {
  return new Date(value).toLocaleString('en-US', {
    ...(timeZone ? { timeZone } : {}),
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatZonedDate(value: number, timeZone?: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    ...(timeZone ? { timeZone } : {}),
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function zonedDateKey(value: number, timeZone?: string): string {
  const parts = getZonedParts(value, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function latestZonedScheduledOccurrenceAtOrBefore(
  now: number,
  schedule: SecondBrainRoutineSchedule,
  anchorAt?: number,
  timeZone?: string,
): number | null {
  const zone = normalizeTimeZone(timeZone);
  if (!zone) return null;
  const current = getZonedParts(now, zone);

  if (schedule.cadence === 'hourly') {
    const minute = Number.isFinite(schedule.minute) ? Number(schedule.minute) : 0;
    if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;
    for (let offset = 0; offset <= 25; offset += 1) {
      const local = addLocalHours(current, -offset);
      const candidate = timestampFromZonedParts({ ...local, minute, second: 0 }, zone);
      if (candidate <= now) return candidate;
    }
    return null;
  }

  const timeMatch = String(schedule.time ?? '').match(/^(\d{2}):(\d{2})$/);
  if (!timeMatch) return null;
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;

  if (schedule.cadence === 'daily' || schedule.cadence === 'weekdays') {
    for (let offset = 0; offset <= 7; offset += 1) {
      const local = addLocalDays(current, -offset);
      if (schedule.cadence === 'weekdays' && (localWeekday(local) === 0 || localWeekday(local) === 6)) continue;
      const candidate = timestampFromZonedParts({ ...local, hour, minute, second: 0 }, zone);
      if (candidate <= now) return candidate;
    }
    return null;
  }

  if (schedule.cadence === 'weekly' || schedule.cadence === 'fortnightly') {
    const targetDay = weekdayToDayNumber(schedule.dayOfWeek);
    if (targetDay == null) return null;
    for (let offset = 0; offset <= 21; offset += 1) {
      const local = addLocalDays(current, -offset);
      if (localWeekday(local) !== targetDay) continue;
      const candidate = timestampFromZonedParts({ ...local, hour, minute, second: 0 }, zone);
      if (candidate > now) continue;
      if (schedule.cadence === 'fortnightly') {
        const anchor = Number.isFinite(anchorAt) ? Number(anchorAt) : candidate;
        const elapsedDays = Math.floor((localDayOrdinal(local) - localDayOrdinal(getZonedParts(anchor, zone))) / 7);
        if (elapsedDays < 0 || elapsedDays % 2 !== 0) continue;
      }
      return candidate;
    }
    return null;
  }

  if (schedule.cadence === 'monthly') {
    const targetDay = Number.isFinite(schedule.dayOfMonth) ? Number(schedule.dayOfMonth) : NaN;
    if (!Number.isInteger(targetDay) || targetDay < 1 || targetDay > 31) return null;
    for (let offset = 0; offset <= 12; offset += 1) {
      const local = addLocalMonths(current, -offset);
      if (targetDay > daysInLocalMonth(local.year, local.month)) continue;
      const candidate = timestampFromZonedParts({ year: local.year, month: local.month, day: targetDay, hour, minute, second: 0 }, zone);
      if (candidate <= now) return candidate;
    }
  }

  return null;
}

function getZonedParts(value: number, timeZone: string | undefined): ZonedParts {
  if (!timeZone) {
    const date = new Date(value);
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
    };
  }
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function timestampFromZonedParts(parts: ZonedParts, timeZone: string): number {
  let guess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, 0);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = getZonedParts(guess, timeZone);
    const diff = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, 0)
      - Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second, 0);
    if (diff === 0) break;
    guess += diff;
  }
  return guess;
}

function addLocalDays(parts: ZonedParts, days: number): ZonedParts {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, parts.hour, parts.minute, parts.second));
  return fromUtcCalendarDate(date);
}

function addLocalHours(parts: ZonedParts, hours: number): ZonedParts {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour + hours, parts.minute, parts.second));
  return fromUtcCalendarDate(date);
}

function addLocalMonths(parts: ZonedParts, months: number): ZonedParts {
  const date = new Date(Date.UTC(parts.year, parts.month - 1 + months, 1, parts.hour, parts.minute, parts.second));
  return fromUtcCalendarDate(date);
}

function fromUtcCalendarDate(date: Date): ZonedParts {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
  };
}

function localWeekday(parts: ZonedParts): number {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

function localDayOrdinal(parts: ZonedParts): number {
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / DAY_MS);
}

function daysInLocalMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function weekdayToDayNumber(weekday: SecondBrainRoutineWeekday | undefined): number | null {
  const weekdayMap: SecondBrainRoutineWeekday[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];
  if (!weekday) return null;
  const index = weekdayMap.indexOf(weekday);
  return index >= 0 ? index : null;
}
