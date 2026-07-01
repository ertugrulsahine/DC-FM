import { describe, expect, it } from 'vitest';
import { calculateFinancialModel, cloneDefaultInput, generateTimeline } from './financialEngine.js';

const tolerance = 1e-6;

describe('financial engine', () => {
  it('converges IDC circularity in the default case', () => {
    const result = calculateFinancialModel(cloneDefaultInput());
    const expectedIdc = ((result.epcCost + result.idc) * 0.7) / 2 * 0.08;

    expect(result.idcIterations < 100).toBe(true);
    expect(Math.abs(result.idc - expectedIdc) < tolerance).toBe(true);
  });

  it('balances Uses and Sources within tolerance', () => {
    const result = calculateFinancialModel(cloneDefaultInput());

    expect(Math.abs(result.sources.difference) < tolerance).toBe(true);
    expect(Math.abs(result.uses.total - result.sources.total) < tolerance).toBe(true);
  });

  it('balances the Balance Sheet in every period', () => {
    const result = calculateFinancialModel(cloneDefaultInput());

    for (const period of result.periods) {
      expect(Math.abs(period.balanceSheetDifference) < tolerance).toBe(true);
      expect(Math.abs(period.assets - (period.liabilities + period.equity)) < tolerance).toBe(true);
    }
  });

  it('maintains debt roll-forward integrity', () => {
    const result = calculateFinancialModel(cloneDefaultInput());

    for (const period of result.periods) {
      expect(Math.abs(period.closingDebt - (period.openingDebt + period.debtDraw - period.repayment)) < 1e-8).toBe(true);
    }
  });

  it('maintains PP&E roll-forward integrity', () => {
    const result = calculateFinancialModel(cloneDefaultInput());

    for (const period of result.periods) {
      expect(Math.abs(period.closingPpe - (period.openingPpe + period.capex - period.depreciation)) < 1e-8).toBe(true);
    }
  });

  it('prevents dividend distributions when DSCR or cash tests fail', () => {
    const lowDscr = calculateFinancialModel(cloneDefaultInput({ operatingCashFlow: Array.from({ length: 24 }, () => 10) }));
    const lowCash = calculateFinancialModel(cloneDefaultInput({ minimumDistributionCash: 10_000 }));

    expect(lowDscr.periods.some((period) => period.dscr < 1.2)).toBe(true);
    expect(lowDscr.periods.every((period) => period.dividend === 0)).toBe(true);
    expect(lowCash.periods.every((period) => period.cashBeforeDistribution < 10_000 || period.dividend === 0)).toBe(true);
  });

  it('flows EPC cost changes through total project cost, debt, equity, and IDC', () => {
    const base = calculateFinancialModel(cloneDefaultInput());
    const increased = calculateFinancialModel(cloneDefaultInput({ epcCost: 1_250 }));

    expect(increased.totalProjectCost > base.totalProjectCost).toBe(true);
    expect(increased.debt > base.debt).toBe(true);
    expect(increased.equity > base.equity).toBe(true);
    expect(increased.idc > base.idc).toBe(true);
  });

  it('flows gearing changes through calculated debt and equity', () => {
    const lowerGearing = calculateFinancialModel(cloneDefaultInput({ gearing: 0.6 }));
    const higherGearing = calculateFinancialModel(cloneDefaultInput({ gearing: 0.8 }));

    expect(higherGearing.debt > lowerGearing.debt).toBe(true);
    expect(higherGearing.equity < lowerGearing.equity).toBe(true);
  });

  it('flows debt allocation changes through calculated facility sizes', () => {
    const result = calculateFinancialModel(cloneDefaultInput({
      facilities: [
        { name: 'Senior', allocationPercent: 80 },
        { name: 'Mezzanine', allocationPercent: 20 },
      ],
    }));

    expect(Math.abs((result.facilities[0]?.size ?? 0) - result.debt * 0.8) < 1e-8).toBe(true);
    expect(Math.abs((result.facilities[1]?.size ?? 0) - result.debt * 0.2) < 1e-8).toBe(true);
  });

  it('fails validation when active debt allocation percentages do not sum to 100%', () => {
    expect(() => calculateFinancialModel(cloneDefaultInput({
      facilities: [
        { name: 'Senior', allocationPercent: 60 },
        { name: 'Mezzanine', allocationPercent: 30 },
        { name: 'Inactive', allocationPercent: 10, active: false },
      ],
    }))).toThrow(/sum to 100%/);
  });

  it('generates timelines for monthly, quarterly, semi-annual, and annual periodicity', () => {
    expect(generateTimeline('2026-01-01', 4, 'monthly')).toEqual(['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01']);
    expect(generateTimeline('2026-01-01', 4, 'quarterly')).toEqual(['2026-01-01', '2026-04-01', '2026-07-01', '2026-10-01']);
    expect(generateTimeline('2026-01-01', 4, 'semi-annual')).toEqual(['2026-01-01', '2026-07-01', '2027-01-01', '2027-07-01']);
    expect(generateTimeline('2026-01-01', 4, 'annual')).toEqual(['2026-01-01', '2027-01-01', '2028-01-01', '2029-01-01']);
  });
});
