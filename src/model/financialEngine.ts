export type Periodicity = 'monthly' | 'quarterly' | 'semi-annual' | 'annual';

export interface FacilityInput {
  name: string;
  allocationPercent: number;
  active?: boolean;
}

export interface EngineInput {
  epcCost: number;
  gearing: number;
  baseEquity: number;
  annualInterestRate: number;
  constructionPeriods: number;
  operatingPeriods: number;
  targetDscr: number;
  minimumDistributionCash: number;
  operatingCashFlow: number[];
  scheduledDebtAmortization: number[];
  facilities: FacilityInput[];
  openingPpe: number;
  depreciation: number[];
  capex: number[];
  periodicity?: Periodicity;
  startDate?: string;
  periods?: number;
}

export interface PeriodResult {
  period: number;
  openingDebt: number;
  debtDraw: number;
  interest: number;
  repayment: number;
  closingDebt: number;
  openingPpe: number;
  capex: number;
  depreciation: number;
  closingPpe: number;
  cashBeforeDistribution: number;
  dscr: number;
  dividend: number;
  closingCash: number;
  assets: number;
  liabilities: number;
  equity: number;
  balanceSheetDifference: number;
}

export interface EngineResult {
  totalProjectCost: number;
  epcCost: number;
  idc: number;
  debt: number;
  equity: number;
  uses: { epc: number; idc: number; total: number };
  sources: { debt: number; equity: number; total: number; difference: number };
  facilities: Array<FacilityInput & { size: number }>;
  periods: PeriodResult[];
  timeline: string[];
  idcIterations: number;
}

const round = (value: number, decimals = 10) => Number(value.toFixed(decimals));
const getValue = (values: number[], index: number) => values[index] ?? 0;

export function generateTimeline(startDate: string, periods: number, periodicity: Periodicity): string[] {
  const monthStep: Record<Periodicity, number> = {
    monthly: 1,
    quarterly: 3,
    'semi-annual': 6,
    annual: 12,
  };
  const start = new Date(`${startDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) throw new Error(`Invalid start date: ${startDate}`);

  return Array.from({ length: periods }, (_, index) => {
    const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index * monthStep[periodicity], start.getUTCDate()));
    return date.toISOString().slice(0, 10);
  });
}

export function validateDebtAllocations(facilities: FacilityInput[], tolerance = 1e-8): void {
  const active = facilities.filter((facility) => facility.active !== false);
  const total = active.reduce((sum, facility) => sum + facility.allocationPercent, 0);
  if (Math.abs(total - 100) > tolerance) {
    throw new Error(`Active debt allocation percentages must sum to 100%; received ${round(total, 8)}%.`);
  }
}

export function calculateFinancialModel(input: EngineInput): EngineResult {
  validateDebtAllocations(input.facilities);
  if (input.gearing < 0 || input.gearing > 1) throw new Error('Gearing must be between 0 and 1.');
  if (input.constructionPeriods < 1) throw new Error('At least one construction period is required.');

  let idc = 0;
  let debt = 0;
  const tolerance = 1e-9;
  let iterations = 0;
  for (; iterations < 100; iterations += 1) {
    const totalProjectCost = input.epcCost + idc;
    const nextDebt = totalProjectCost * input.gearing;
    const averageConstructionDebt = nextDebt / 2;
    const nextIdc = averageConstructionDebt * input.annualInterestRate * (input.constructionPeriods / 12);
    if (Math.abs(nextIdc - idc) <= tolerance) {
      idc = nextIdc;
      debt = nextDebt;
      break;
    }
    idc = nextIdc;
    debt = nextDebt;
  }

  const totalProjectCost = input.epcCost + idc;
  debt = totalProjectCost * input.gearing;
  const equity = totalProjectCost - debt + input.baseEquity;
  const sourcesDebt = debt;
  const sourcesEquity = totalProjectCost - debt;
  const sourcesTotal = sourcesDebt + sourcesEquity;
  const facilities = input.facilities.map((facility) => ({
    ...facility,
    size: facility.active === false ? 0 : debt * (facility.allocationPercent / 100),
  }));

  let openingDebt = 0;
  let openingPpe = input.openingPpe;
  let retainedCash = 0;
  const periodCount = Math.max(input.operatingPeriods, input.constructionPeriods);
  const periods: PeriodResult[] = [];

  for (let period = 0; period < periodCount; period += 1) {
    const debtDraw = period < input.constructionPeriods ? debt / input.constructionPeriods : 0;
    const interest = openingDebt * (input.annualInterestRate / 12);
    const repayment = Math.min(getValue(input.scheduledDebtAmortization, period), openingDebt + debtDraw);
    const closingDebt = openingDebt + debtDraw - repayment;
    const capex = getValue(input.capex, period) + (period < input.constructionPeriods ? input.epcCost / input.constructionPeriods : 0);
    const depreciation = getValue(input.depreciation, period);
    const closingPpe = openingPpe + capex - depreciation;
    const operatingCashFlow = getValue(input.operatingCashFlow, period);
    const cashBeforeDistribution = retainedCash + operatingCashFlow - interest - repayment;
    const dscr = repayment + interest > 0 ? operatingCashFlow / (repayment + interest) : Number.POSITIVE_INFINITY;
    const canDistribute = dscr >= input.targetDscr && cashBeforeDistribution >= input.minimumDistributionCash;
    const dividend = canDistribute ? Math.max(0, cashBeforeDistribution - input.minimumDistributionCash) : 0;
    const closingCash = cashBeforeDistribution - dividend;
    const assets = closingPpe + closingCash;
    const liabilities = closingDebt;
    const periodEquity = assets - liabilities;
    const balanceSheetDifference = assets - (liabilities + periodEquity);

    periods.push({
      period: period + 1,
      openingDebt: round(openingDebt),
      debtDraw: round(debtDraw),
      interest: round(interest),
      repayment: round(repayment),
      closingDebt: round(closingDebt),
      openingPpe: round(openingPpe),
      capex: round(capex),
      depreciation: round(depreciation),
      closingPpe: round(closingPpe),
      cashBeforeDistribution: round(cashBeforeDistribution),
      dscr: round(dscr),
      dividend: round(dividend),
      closingCash: round(closingCash),
      assets: round(assets),
      liabilities: round(liabilities),
      equity: round(periodEquity),
      balanceSheetDifference: round(balanceSheetDifference),
    });

    openingDebt = closingDebt;
    openingPpe = closingPpe;
    retainedCash = closingCash;
  }

  const timeline = generateTimeline(input.startDate ?? '2026-01-01', input.periods ?? periodCount, input.periodicity ?? 'monthly');

  return {
    totalProjectCost: round(totalProjectCost),
    epcCost: input.epcCost,
    idc: round(idc),
    debt: round(debt),
    equity: round(equity),
    uses: { epc: input.epcCost, idc: round(idc), total: round(totalProjectCost) },
    sources: { debt: round(sourcesDebt), equity: round(sourcesEquity), total: round(sourcesTotal), difference: round(totalProjectCost - sourcesTotal) },
    facilities,
    periods,
    timeline,
    idcIterations: iterations + 1,
  };
}

export const defaultModelInput: EngineInput = {
  epcCost: 1_000,
  gearing: 0.7,
  baseEquity: 0,
  annualInterestRate: 0.08,
  constructionPeriods: 12,
  operatingPeriods: 24,
  targetDscr: 1.2,
  minimumDistributionCash: 25,
  operatingCashFlow: Array.from({ length: 24 }, () => 80),
  scheduledDebtAmortization: Array.from({ length: 24 }, () => 25),
  facilities: [
    { name: 'Senior', allocationPercent: 70 },
    { name: 'Mezzanine', allocationPercent: 30 },
  ],
  openingPpe: 0,
  depreciation: Array.from({ length: 24 }, (_, index) => (index < 12 ? 0 : 20)),
  capex: Array.from({ length: 24 }, () => 0),
  startDate: '2026-01-01',
  periods: 24,
  periodicity: 'monthly',
};

export function cloneDefaultInput(overrides: Partial<EngineInput> = {}): EngineInput {
  const merged = { ...defaultModelInput, ...overrides };
  return {
    ...merged,
    operatingCashFlow: [...merged.operatingCashFlow],
    scheduledDebtAmortization: [...merged.scheduledDebtAmortization],
    facilities: merged.facilities.map((facility) => ({ ...facility })),
    depreciation: [...merged.depreciation],
    capex: [...merged.capex],
  };
}
