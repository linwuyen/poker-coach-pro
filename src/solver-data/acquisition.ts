import { TruthCoverageTargetEnvelope, TruthEngineId, UnifiedTruthCoverageReport, validateTruthCoverageTargets } from '../strategy-engine-v2/truthPortfolio';

export type TruthLicenseStatus = 'owned' | 'licensed' | 'open' | 'unknown';

export interface TruthAcquisitionSource {
  schemaVersion: 1;
  id: string;
  version: string;
  engine: TruthEngineId;
  solverName: string;
  solverVersion: string;
  reference: string;
  generatedAt: string;
  contentHash: string;
  licenseStatus: TruthLicenseStatus;
  licenseReference?: string;
  advertisedContextKeys: string[];
  notes?: string;
}

export interface TruthAcquisitionInventory {
  sources: TruthAcquisitionSource[];
  duplicatePayloads: Array<{ contentHash: string; sourceKeys: string[] }>;
  installableSources: number;
  unknownLicenseSources: number;
}

export interface TruthAcquisitionGap {
  targetId: string;
  engine: TruthEngineId;
  label: string;
  contextKey: string;
  weight: number;
  status: 'missing-context' | 'insufficient-combos' | 'insufficient-full-ev' | 'ambiguous' | 'satisfied';
  uniqueComboDeficit: number;
  fullEvComboDeficit: number;
  ambiguousCombos: number;
  candidateSourceKeys: string[];
}

export interface TruthAcquisitionPlan {
  targetKey: string;
  weightedCoverage: number;
  gaps: TruthAcquisitionGap[];
  missingWeight: number;
  candidateSources: TruthAcquisitionSource[];
  caveats: string[];
}

function sourceKey(source: TruthAcquisitionSource): string { return `${source.id}@${source.version}`; }

export function validateTruthAcquisitionSource(raw: TruthAcquisitionSource): TruthAcquisitionSource {
  if (!raw || raw.schemaVersion !== 1 || !raw.id || !raw.version || !raw.engine || !raw.solverName || !raw.solverVersion || !raw.reference || !raw.contentHash || !Array.isArray(raw.advertisedContextKeys) || !Number.isFinite(Date.parse(raw.generatedAt))) throw new Error('Truth acquisition source requires identity, engine, provenance and a content hash.');
  if (!['v2-preflop', 'v3-heads-up', 'v4-multiway'].includes(raw.engine)) throw new Error(`${raw.id}: unsupported truth engine.`);
  if (!['owned', 'licensed', 'open', 'unknown'].includes(raw.licenseStatus)) throw new Error(`${raw.id}: invalid license status.`);
  if (raw.licenseStatus !== 'unknown' && !raw.licenseReference) throw new Error(`${raw.id}: installable truth requires an explicit license reference.`);
  if (raw.advertisedContextKeys.some(key => !key || typeof key !== 'string')) throw new Error(`${raw.id}: advertised context keys must be non-empty strings.`);
  return JSON.parse(JSON.stringify(raw)) as TruthAcquisitionSource;
}

export function buildTruthAcquisitionInventory(rawSources: TruthAcquisitionSource[]): TruthAcquisitionInventory {
  const keys = new Set<string>();
  const hashes = new Map<string, string[]>();
  const sources = rawSources.map(validateTruthAcquisitionSource);
  for (const source of sources) {
    const key = sourceKey(source);
    if (keys.has(key)) throw new Error(`Duplicate truth acquisition source ${key}.`);
    keys.add(key);
    const owners = hashes.get(source.contentHash) || [];
    owners.push(key);
    hashes.set(source.contentHash, owners);
  }
  return {
    sources,
    duplicatePayloads: [...hashes.entries()].filter(([, owners]) => owners.length > 1).map(([contentHash, sourceKeys]) => ({ contentHash, sourceKeys })),
    installableSources: sources.filter(source => source.licenseStatus !== 'unknown').length,
    unknownLicenseSources: sources.filter(source => source.licenseStatus === 'unknown').length,
  };
}

/**
 * P24 turns a P19 target envelope into a concrete acquisition backlog. It never claims missing
 * solver data exists, and it never marks an unknown-license source as installable.
 */
export function planTruthAcquisition(report: UnifiedTruthCoverageReport, rawTargets: TruthCoverageTargetEnvelope, rawSources: TruthAcquisitionSource[]): TruthAcquisitionPlan {
  const targets = validateTruthCoverageTargets(rawTargets);
  const inventory = buildTruthAcquisitionInventory(rawSources);
  const cells = new Map(report.cells.map(cell => [`${cell.engine}|${cell.contextKey}`, cell]));
  const installable = inventory.sources.filter(source => source.licenseStatus !== 'unknown');
  const gaps: TruthAcquisitionGap[] = targets.targets.map(target => {
    const cell = cells.get(`${target.engine}|${target.contextKey}`);
    const uniqueComboDeficit = Math.max(0, target.minimumUniqueCombos - (cell?.uniqueCombos || 0));
    const fullEvComboDeficit = Math.max(0, target.minimumFullEvCombos - (cell?.fullEvCombos || 0));
    const ambiguousCombos = cell?.ambiguousCombos || 0;
    let status: TruthAcquisitionGap['status'] = 'satisfied';
    if (!cell) status = 'missing-context';
    else if (ambiguousCombos > 0) status = 'ambiguous';
    else if (uniqueComboDeficit > 0) status = 'insufficient-combos';
    else if (fullEvComboDeficit > 0) status = 'insufficient-full-ev';
    const candidateSourceKeys = installable
      .filter(source => source.engine === target.engine && source.advertisedContextKeys.includes(target.contextKey))
      .map(sourceKey)
      .sort();
    return { targetId: target.id, engine: target.engine, label: target.label, contextKey: target.contextKey, weight: target.weight, status, uniqueComboDeficit, fullEvComboDeficit, ambiguousCombos, candidateSourceKeys };
  });
  const totalWeight = gaps.reduce((sum, gap) => sum + gap.weight, 0);
  const coveredWeight = gaps.filter(gap => gap.status === 'satisfied').reduce((sum, gap) => sum + gap.weight, 0);
  const candidateKeys = new Set(gaps.flatMap(gap => gap.status === 'satisfied' ? [] : gap.candidateSourceKeys));
  return {
    targetKey: `${targets.id}@${targets.version}`,
    weightedCoverage: totalWeight ? coveredWeight / totalWeight : 0,
    missingWeight: totalWeight - coveredWeight,
    gaps,
    candidateSources: installable.filter(source => candidateKeys.has(sourceKey(source))),
    caveats: [
      'Acquisition planning identifies missing or ambiguous truth against an explicit target universe; it does not create solver data.',
      'Sources with unknown license status are inventory-only and are never recommended for installation.',
      'A source advertisement is discovery metadata; imported nodes must still pass immutable v2/v3/v4 validation and provenance gates.',
    ],
  };
}
