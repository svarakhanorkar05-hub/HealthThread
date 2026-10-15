export interface PeriodDates {
  id?: string;
  period_start: string;
  period_end: string | null;
}

export interface CycleSummary {
  totalCycles: number;
  avgCycleLength: number | null;
  avgPeriodLength: number | null;
  cycleLengths: number[];
  recentCycleLengths: number[];
  irregular: boolean;
  predictionStart: string | null;
  predictionEnd: string | null;
  predictionIntervals: number;
  predictionReliability: 'limited' | 'more-reliable' | null;
  hasLongPeriod: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function isValidDateOnly(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);

  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function dateOnlyToLocalDate(value: string): Date | null {
  if (!isValidDateOnly(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function localDateToDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getAgeFromDateOfBirth(dateOfBirth: string | null, today = new Date()): number | null {
  if (!dateOfBirth || !isValidDateOnly(dateOfBirth)) return null;
  const birth = dateOnlyToLocalDate(dateOfBirth);
  if (!birth || birth > today) return null;

  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth()
    || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  ) {
    age--;
  }
  return age;
}

function dayNumber(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(0);
  value.setUTCFullYear(year, month - 1, day);
  value.setUTCHours(0, 0, 0, 0);
  return value.getTime() / DAY_MS;
}

function dateFromDayNumber(value: number): string {
  const date = new Date(value * DAY_MS);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function analyzeCycleHistory(
  logs: PeriodDates[],
  today = localDateToDateOnly(new Date()),
  age: number | null = null,
): CycleSummary {
  const usableLogs = logs
    .filter((log) => isValidDateOnly(log.period_start) && log.period_start <= today)
    .sort((a, b) => a.period_start.localeCompare(b.period_start));

  const uniqueStarts = [...new Set(usableLogs.map((log) => log.period_start))];
  const cycleLengths: number[] = [];
  for (let index = 1; index < uniqueStarts.length; index++) {
    const length = dayNumber(uniqueStarts[index]) - dayNumber(uniqueStarts[index - 1]);
    if (length > 0 && length <= 365) cycleLengths.push(length);
  }

  const recentCycleLengths = cycleLengths.slice(-6);
  const expectedMaximum = age !== null && age >= 18 ? 35 : 45;
  const intervalsWithinExpectedRange = recentCycleLengths.every(
    (length) => length >= 21 && length <= expectedMaximum,
  );
  const observedRange = recentCycleLengths.length
    ? Math.max(...recentCycleLengths) - Math.min(...recentCycleLengths)
    : 0;
  const irregular = recentCycleLengths.some(
    (length) => length < 21 || length > expectedMaximum,
  ) || observedRange > 7;

  const durations = usableLogs.flatMap((log) => {
    if (!log.period_end || !isValidDateOnly(log.period_end) || log.period_end < log.period_start) {
      return [];
    }
    const duration = dayNumber(log.period_end) - dayNumber(log.period_start) + 1;
    return duration <= 90 ? [duration] : [];
  });

  let predictionStart: string | null = null;
  let predictionEnd: string | null = null;
  let predictionReliability: CycleSummary['predictionReliability'] = null;

  if (recentCycleLengths.length >= 2 && intervalsWithinExpectedRange && uniqueStarts.length > 0) {
    const lastStart = dayNumber(uniqueStarts[uniqueStarts.length - 1]);
    const typicalLength = median(recentCycleLengths);

    if (observedRange > 7) {
      predictionStart = dateFromDayNumber(lastStart + Math.min(...recentCycleLengths));
      predictionEnd = dateFromDayNumber(lastStart + Math.max(...recentCycleLengths));
    } else {
      predictionStart = dateFromDayNumber(Math.max(lastStart + 21, lastStart + typicalLength - 2));
      predictionEnd = dateFromDayNumber(Math.min(lastStart + expectedMaximum, lastStart + typicalLength + 2));
    }

    predictionReliability = recentCycleLengths.length >= 3 && !irregular
      ? 'more-reliable'
      : 'limited';
  }

  return {
    totalCycles: uniqueStarts.length,
    avgCycleLength: cycleLengths.length
      ? Math.round(cycleLengths.reduce((sum, length) => sum + length, 0) / cycleLengths.length)
      : null,
    avgPeriodLength: durations.length
      ? Math.round(durations.reduce((sum, length) => sum + length, 0) / durations.length)
      : null,
    cycleLengths,
    recentCycleLengths,
    irregular,
    predictionStart,
    predictionEnd,
    predictionIntervals: recentCycleLengths.length,
    predictionReliability,
    hasLongPeriod: durations.some((duration) => duration > 7),
  };
}

export function validatePeriodDates(
  start: string,
  end: string,
  existingLogs: PeriodDates[],
  today = localDateToDateOnly(new Date()),
  excludeId?: string,
): string | null {
  if (!isValidDateOnly(start)) return 'Enter a valid period start date.';
  if (start > today) return 'Period start date cannot be in the future.';
  if (end && !isValidDateOnly(end)) return 'Enter a valid period end date.';
  if (end && end > today) return 'Period end date cannot be in the future.';
  if (end && end < start) return 'End date cannot be before start date.';

  const proposedEnd = end || start;
  const overlaps = existingLogs.some((log) => {
    if (excludeId && log.id === excludeId) return false;
    if (!isValidDateOnly(log.period_start)) return false;
    const existingEnd = log.period_end && isValidDateOnly(log.period_end) && log.period_end >= log.period_start
      ? log.period_end
      : log.period_start;
    return start <= existingEnd && proposedEnd >= log.period_start;
  });

  return overlaps ? 'These dates overlap another logged period. Edit that entry or choose different dates.' : null;
}

export function getCycleEducation(age: number | null): {
  heading: string;
  summary: string;
  guidance: string;
} {
  if (age === null) {
    return {
      heading: 'Cycle patterns vary',
      summary: 'Cycle timing can vary and may be less predictable in the first years after periods begin. This tracker only summarizes dates you enter; it cannot tell why a cycle changes or predict exactly what your body will do.',
      guidance: 'If you are young and have questions, a trusted adult or healthcare professional can help. At any age, consider seeking care for pain that affects daily life, bleeding that concerns you, or persistent changes.',
    };
  }

  if (age < 18) {
    return {
      heading: age < 13 ? 'Questions about periods?' : 'When periods are new',
      summary: 'Cycle timing can vary, especially during the first years after periods begin. This tracker only summarizes dates you enter; it cannot tell why a cycle changes or predict exactly what your body will do.',
      guidance: 'If you are worried, in pain that affects daily life, or bleeding feels unusually heavy or long, consider talking with a trusted adult or healthcare professional.',
    };
  }

  return {
    heading: 'Cycle patterns vary',
    summary: 'For many adults, cycles are about 21–35 days and bleeding often lasts 2–7 days, but individual patterns differ. Estimates here use only your logged period start dates.',
    guidance: 'Consider speaking with a healthcare professional about persistent changes, pain that affects daily activities, or bleeding that concerns you.',
  };
}
