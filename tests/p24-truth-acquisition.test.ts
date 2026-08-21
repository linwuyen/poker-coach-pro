import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTruthAcquisitionInventory, planTruthAcquisition, TruthAcquisitionSource } from '../src/solver-data/acquisition';
import { TruthCoverageTargetEnvelope, UnifiedTruthCoverageReport } from '../src/strategy-engine-v2/truthPortfolio';

const report: UnifiedTruthCoverageReport = {
  generatedAt:'2026-08-21T05:00:00Z',
  cells:[
    {engine:'v3-heads-up',contextKey:'ctx:covered',nodes:1,uniqueCombos:20,fullEvCombos:20,ambiguousCombos:0,sourceReferences:['solver://covered']},
    {engine:'v3-heads-up',contextKey:'ctx:ambiguous',nodes:2,uniqueCombos:0,fullEvCombos:0,ambiguousCombos:10,sourceReferences:['solver://a','solver://b']},
  ],
  totals:{verifiedNodes:3,uniqueContexts:2,uniqueCombos:20,fullEvCombos:20,ambiguousCombos:10,storedBytes:1000,packManifests:2},
  byEngine:{
    'v2-preflop':{nodes:0,contexts:0,uniqueCombos:0,fullEvCombos:0,ambiguousCombos:0},
    'v3-heads-up':{nodes:3,contexts:2,uniqueCombos:20,fullEvCombos:20,ambiguousCombos:10},
    'v4-multiway':{nodes:0,contexts:0,uniqueCombos:0,fullEvCombos:0,ambiguousCombos:0},
  },
  targetResults:[],
  caveats:[],
};

const targets: TruthCoverageTargetEnvelope = {schemaVersion:1,id:'cash-6max',version:'1',generatedAt:'2026-08-21T05:00:00Z',reference:'fixture://targets',targets:[
  {id:'covered',engine:'v3-heads-up',label:'Covered',contextKey:'ctx:covered',weight:2,minimumUniqueCombos:10,minimumFullEvCombos:10},
  {id:'missing',engine:'v4-multiway',label:'Missing multiway',contextKey:'ctx:missing',weight:3,minimumUniqueCombos:12,minimumFullEvCombos:8},
  {id:'ambiguous',engine:'v3-heads-up',label:'Ambiguous',contextKey:'ctx:ambiguous',weight:1,minimumUniqueCombos:8,minimumFullEvCombos:4},
]};

const licensed: TruthAcquisitionSource = {schemaVersion:1,id:'solver-pack',version:'1',engine:'v4-multiway',solverName:'FixtureSolver',solverVersion:'1',reference:'fixture://solver-pack',generatedAt:'2026-08-21T05:00:00Z',contentHash:'sha256:abc',licenseStatus:'licensed',licenseReference:'fixture://license',advertisedContextKeys:['ctx:missing']};
const unknown: TruthAcquisitionSource = {...licensed,id:'unknown-pack',contentHash:'sha256:def',licenseStatus:'unknown',licenseReference:undefined};

test('P24 inventory deduplicates payload identity and separates unknown-license sources',()=>{
  const inventory=buildTruthAcquisitionInventory([licensed,unknown,{...licensed,id:'mirror',contentHash:'sha256:abc'}]);
  assert.equal(inventory.installableSources,2);
  assert.equal(inventory.unknownLicenseSources,1);
  assert.equal(inventory.duplicatePayloads.length,1);
  assert.deepEqual(inventory.duplicatePayloads[0].sourceKeys,['solver-pack@1','mirror@1']);
});

test('P24 turns an explicit P19 denominator into a missing/ambiguous acquisition backlog without inventing data',()=>{
  const plan=planTruthAcquisition(report,targets,[licensed,unknown]);
  assert.equal(plan.weightedCoverage,2/6);
  assert.equal(plan.gaps.find(g=>g.targetId==='covered')?.status,'satisfied');
  assert.equal(plan.gaps.find(g=>g.targetId==='missing')?.status,'missing-context');
  assert.equal(plan.gaps.find(g=>g.targetId==='ambiguous')?.status,'ambiguous');
  assert.deepEqual(plan.gaps.find(g=>g.targetId==='missing')?.candidateSourceKeys,['solver-pack@1']);
  assert.equal(plan.candidateSources.length,1);
  assert.equal(plan.candidateSources[0].licenseStatus,'licensed');
});
