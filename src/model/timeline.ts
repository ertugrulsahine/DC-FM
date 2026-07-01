import type { Frequency, Period } from './types';
const monthsPerPeriod: Record<Frequency, number> = { monthly: 1, quarterly: 3, semiAnnual: 6, annual: 12 };
export function addMonths(date: Date, months: number): Date { const d = new Date(date); d.setMonth(d.getMonth() + months); return d; }
export function generateTimeline(startDate: string, periods: number, frequency: Frequency): Period[] {
  const step = monthsPerPeriod[frequency]; const start = new Date(`${startDate}T00:00:00Z`);
  return Array.from({ length: periods }, (_, index) => { const s = addMonths(start, index * step); const e = addMonths(s, step); e.setUTCDate(e.getUTCDate() - 1); return { index, label: `${s.getUTCFullYear()}-${String(s.getUTCMonth()+1).padStart(2,'0')}`, start: s, end: e, year: s.getUTCFullYear() }; });
}
export function periodsPerYear(frequency: Frequency): number { return 12 / monthsPerPeriod[frequency]; }
