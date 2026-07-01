import { describe, expect, it } from 'vitest';
import { defaultInputs, runModel, solveIDC, validateDebtAllocation } from './financeEngine';
import { generateTimeline } from './timeline';
import type { ModelInputs } from './types';
const clone=():ModelInputs=>JSON.parse(JSON.stringify(defaultInputs));
describe('timeline',()=>{ it.each(['monthly','quarterly','semiAnnual','annual'] as const)('generates %s timeline',frequency=>{ const t=generateTimeline('2026-01-01',4,frequency); expect(t).toHaveLength(4); expect(t[0].label).toBe('2026-01'); }); });
describe('finance engine',()=>{
 it('IDC solver convergence',()=>{ const idc=solveIDC([100,100,0,0],0.12,2,4); expect(idc[0]).toBeCloseTo(3.1,1); expect(idc[1]).toBeGreaterThan(idc[0]); expect(idc[2]).toBe(0); });
 it('Uses/Sources balance',()=>{ const out=runModel(clone()); expect(out.checks.usesSourcesBalanced).toBe(true); expect(out.totalUses).toBeCloseTo(out.debtSize+out.equitySize,2); });
 it('Balance Sheet balance check is produced',()=>{ const out=runModel(clone()); expect(typeof out.checks.balanceSheetBalanced).toBe('boolean'); expect(out.rows.every(r=>Number.isFinite(r.assets)&&Number.isFinite(r.liabilitiesEquity))).toBe(true); });
 it('debt roll-forward',()=>{ const out=runModel(clone()); expect(out.checks.debtRollForward).toBe(true); });
 it('PP&E roll-forward',()=>{ const out=runModel(clone()); expect(out.checks.ppeRollForward).toBe(true); });
 it('dividend lock-up',()=>{ const i=clone(); i.constants.dividendLockupDsra=1000; const out=runModel(i); expect(out.rows.reduce((s,r)=>s+r.dividends,0)).toBe(0); });
 it('EPC sensitivity',()=>{ const base=runModel(clone()); const i=clone(); i.sensitivity.epcMultiplier=1.1; expect(runModel(i).totalUses).toBeGreaterThan(base.totalUses); });
 it('gearing sensitivity',()=>{ const low=clone(); low.sensitivity.gearing=.5; const high=clone(); high.sensitivity.gearing=.8; expect(runModel(high).debtSize).toBeGreaterThan(runModel(low).debtSize); });
 it('debt allocation sensitivity',()=>{ const a=clone(); const b=clone(); b.sensitivity.debtAllocation={senior:.75,mezzanine:.2,shareholder:.05}; const seniorA=runModel(a).debtSchedules.filter(d=>d.instrumentId==='senior').reduce((s,d)=>s+d.draw,0); const seniorB=runModel(b).debtSchedules.filter(d=>d.instrumentId==='senior').reduce((s,d)=>s+d.draw,0); expect(seniorB).toBeLessThan(seniorA); });
 it('debt allocation validation',()=>{ const i=clone(); i.sensitivity.debtAllocation={senior:1,mezzanine:.5,shareholder:0}; expect(validateDebtAllocation(i).length).toBeGreaterThan(0); });
});
