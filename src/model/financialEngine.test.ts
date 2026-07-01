import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateFinancialModel, cloneDefaultInput, generateTimeline } from './financialEngine.js';

const tolerance = 1e-6;

test('financial engine', async (t) => {
  await t.test('converges IDC circularity in the default case', () => {
    const result = calculateFinancialModel(cloneDefaultInput());
    const expectedIdc = ((result.epcCost + result.idc) * 0.7) / 2 * 0.08;

    assert.ok(result.idcIterations < 100);
    assert.ok(Math.abs(result.idc - expectedIdc) < tolerance);
  });

  await t.test('balances Uses and Sources within tolerance', () => {
    const result = calculateFinancialModel(cloneDefaultInput());

    assert.ok(Math.abs(result.sources.difference) < tolerance);
    assert.ok(Math.abs(result.uses.total - result.sources.total) < tolerance);
  });

  await t.test('balances the Balance Sheet in every period', () => {
    const result = calculateFinancialModel(cloneDefaultInput());

    for (const period of result.periods) {
      assert.ok(Math.abs(period.balanceSheetDifference) < tolerance);
      assert.ok(Math.abs(period.assets - (period.liabilities + period.equity)) < tolerance);
    }
  });

  await t.test('maintains debt roll-forward integrity', () => {
    const result = calculateFinancialModel(cloneDefaultInput());

    for (const period of result.periods) {
      assert.ok(Math.abs(period.closingDebt - (period.openingDebt + period.debtDraw - period.repayment)) < 1e-8);
    }
  });

  await t.test('maintains PP&E roll-forward integrity', () => {
    const result = calculateFinancialModel(cloneDefaultInput());

    for (const period of result.periods) {
      assert.ok(Math.abs(period.closingPpe - (period.openingPpe + period.capex - period.depreciation)) < 1e-8);
    }
  });

  await t.test('prevents dividend distributions when DSCR or cash tests fail', () => {
    const lowDscr = calculateFinancialModel(cloneDefaultInput({ operatingCashFlow: Array.from({ length: 24 }, () => 10) }));
    const lowCash = calculateFinancialModel(cloneDefaultInput({ minimumDistributionCash: 10_000 }));

    assert.equal(lowDscr.periods.some((period) => period.dscr < 1.2), true);
    assert.equal(lowDscr.periods.every((period) => period.dividend === 0), true);
    assert.equal(lowCash.periods.every((period) => period.cashBeforeDistribution < 10_000 || period.dividend === 0), true);
  });

  await t.test('flows EPC cost changes through total project cost, debt, equity, and IDC', () => {
    const base = calculateFinancialModel(cloneDefaultInput());
    const increased = calculateFinancialModel(cloneDefaultInput({ epcCost: 1_250 }));

    assert.ok(increased.totalProjectCost > base.totalProjectCost);
    assert.ok(increased.debt > base.debt);
    assert.ok(increased.equity > base.equity);
    assert.ok(increased.idc > base.idc);
  });

  await t.test('flows gearing changes through calculated debt and equity', () => {
    const lowerGearing = calculateFinancialModel(cloneDefaultInput({ gearing: 0.6 }));
    const higherGearing = calculateFinancialModel(cloneDefaultInput({ gearing: 0.8 }));

    assert.ok(higherGearing.debt > lowerGearing.debt);
    assert.ok(higherGearing.equity < lowerGearing.equity);
  });

  await t.test('flows debt allocation changes through calculated facility sizes', () => {
    const result = calculateFinancialModel(cloneDefaultInput({
      facilities: [
        { name: 'Senior', allocationPercent: 80 },
        { name: 'Mezzanine', allocationPercent: 20 },
      ],
    }));

    assert.ok(Math.abs((result.facilities[0]?.size ?? 0) - result.debt * 0.8) < 1e-8);
    assert.ok(Math.abs((result.facilities[1]?.size ?? 0) - result.debt * 0.2) < 1e-8);
  });

  await t.test('fails validation when active debt allocation percentages do not sum to 100%', () => {
    assert.throws(() => calculateFinancialModel(cloneDefaultInput({
      facilities: [
        { name: 'Senior', allocationPercent: 60 },
        { name: 'Mezzanine', allocationPercent: 30 },
        { name: 'Inactive', allocationPercent: 10, active: false },
      ],
    })), /sum to 100%/);
  });

  await t.test('generates timelines for monthly, quarterly, semi-annual, and annual periodicity', () => {
    assert.deepEqual(generateTimeline('2026-01-01', 4, 'monthly'), ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01']);
    assert.deepEqual(generateTimeline('2026-01-01', 4, 'quarterly'), ['2026-01-01', '2026-04-01', '2026-07-01', '2026-10-01']);
    assert.deepEqual(generateTimeline('2026-01-01', 4, 'semi-annual'), ['2026-01-01', '2026-07-01', '2027-01-01', '2027-07-01']);
    assert.deepEqual(generateTimeline('2026-01-01', 4, 'annual'), ['2026-01-01', '2027-01-01', '2028-01-01', '2029-01-01']);
  });
});
