export type Frequency = 'monthly' | 'quarterly' | 'semiAnnual' | 'annual';
export type DebtKind = 'senior' | 'mezzanine' | 'shareholder';
export interface DebtInstrumentInput { id: string; kind: DebtKind; label: string; priority: number; maxShare: number; interestRate: number; tenorPeriods: number; gracePeriods: number; }
export interface ConstantInputs { startDate: string; periods: number; frequency: Frequency; constructionPeriods: number; epcCost: number; ownerCost: number; contingencyPct: number; vatRate: number; idcRate: number; targetGearing: number; minCashBalance: number; revenuePerPeriod: number; opexPerPeriod: number; depreciationYears: number; taxRate: number; dividendPayoutRatio: number; dividendLockupDsra: number; }
export interface SeriesInputs { revenue?: number[]; opex?: number[]; epcSpend?: number[]; vatRecovery?: number[]; }
export interface SensitivityInputs { epcMultiplier: number; gearing: number; debtAllocation: Record<string, number>; }
export interface ModelInputs { constants: ConstantInputs; series: SeriesInputs; sensitivity: SensitivityInputs; debtInstruments: DebtInstrumentInput[]; }
export interface Period { index: number; label: string; start: Date; end: Date; year: number; }
export interface DebtScheduleRow { period: number; instrumentId: string; opening: number; draw: number; interest: number; principal: number; closing: number; }
export interface ModelRow { period: number; revenue: number; opex: number; ebitda: number; vatIn: number; vatOut: number; vatNet: number; depreciation: number; ebit: number; interest: number; tax: number; dividends: number; cash: number; ppeOpening: number; capex: number; ppeClosing: number; debtOpening: number; debtDraw: number; debtPrincipal: number; debtClosing: number; equity: number; assets: number; liabilitiesEquity: number; }
export interface ModelOutputs { timeline: Period[]; capex: number[]; idc: number[]; totalUses: number; debtSize: number; equitySize: number; debtSchedules: DebtScheduleRow[]; rows: ModelRow[]; metrics: Record<string, number>; checks: Record<string, boolean>; validationErrors: string[]; }
