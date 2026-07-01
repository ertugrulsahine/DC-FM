import type { Frequency, Period } from './types';
const monthsPerPeriodMap: Record<Frequency, number> = { monthly: 1, quarterly: 3, semiAnnual: 6, annual: 12 };
export function addMonths(date: Date, months: number): Date { const d = new Date(date); d.setUTCMonth(d.getUTCMonth() + months); return d; }
export function periodsPerYear(frequency: Frequency): number { return 12 / monthsPerPeriodMap[frequency]; }
export function monthsPerPeriod(frequency: Frequency): number { return monthsPerPeriodMap[frequency]; }
export function generateTimeline(startDate: string, periods: number, frequency: Frequency, constructionPeriods = 0): Period[] {
  const step = monthsPerPeriodMap[frequency]; const ppy = periodsPerYear(frequency); const start = new Date(`${startDate}T00:00:00Z`);
  return Array.from({ length: periods }, (_, index) => { const s = addMonths(start, index * step); const eExclusive = addMonths(s, step); const e = new Date(eExclusive); e.setUTCDate(e.getUTCDate() - 1); const daysInPeriod = Math.round((eExclusive.getTime() - s.getTime()) / 86400000); return { index, label: `${s.getUTCFullYear()}-${String(s.getUTCMonth()+1).padStart(2,'0')}`, start: s, end: e, year: s.getUTCFullYear(), monthsInPeriod: step, daysInPeriod, periodsPerYear: ppy, isOperating: index >= constructionPeriods, operatingProration: index >= constructionPeriods ? 1 : 0 }; });
}
