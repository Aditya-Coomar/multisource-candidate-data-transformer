import { createHash } from 'node:crypto';
import logger from '../../logger';
import {
  createConfidenceScore,
  createProvenance,
  createSourceRecord,
} from '../../models';
import type {
  ConfidenceScore,
  Location,
  NormalizedPartialCandidate,
  Provenance,
  SourceRecord,
} from '../../models';
import type { MergeStrategy } from './merge.interface';
import type {
  CandidateGroup,
  GroupedCandidate,
  MergeConfig,
  MergeFieldCandidate,
  MergeMetrics,
  MergePlan,
  MergeStrategyName,
} from './merge.types';

const TECHNICAL_ENTITY_KEYS = new Set(['id', 'provenance', 'confidence']);

type ComparableRecord = Record<string, unknown>;

export interface MergeContext {
  readonly currentGroup: CandidateGroup;
  readonly mergePlan: MergePlan;
  readonly config: MergeConfig;
  readonly strategies: Readonly<Record<MergeStrategyName, MergeStrategy>>;
  readonly logger: typeof logger;
  readonly metrics: MergeMetrics;
  readonly mergeTimestamp: string;
}

export function createMergeContext(input: {
  currentGroup: CandidateGroup;
  mergePlan: MergePlan;
  config: MergeConfig;
  strategies: Readonly<Record<MergeStrategyName, MergeStrategy>>;
}): MergeContext {
  return Object.freeze({
    currentGroup: input.currentGroup,
    mergePlan: input.mergePlan,
    config: input.config,
    strategies: input.strategies,
    logger,
    metrics: Object.freeze({
      candidateCount: input.currentGroup.candidates.length,
      sourceRecordCount: input.currentGroup.sourceRecords.length,
      fieldCount: Object.keys(input.mergePlan.fields).length,
      conflictCount: input.mergePlan.conflictCount,
    }),
    mergeTimestamp: getLatestSourceTimestamp(input.currentGroup.sourceRecords),
  });
}

export function createDeterministicId(
  namespace: string,
  parts: readonly string[],
): string {
  const hash = createHash('sha1');
  hash.update(namespace);

  for (const part of parts) {
    hash.update('::');
    hash.update(part);
  }

  const bytes = hash.digest().slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

export function normalizeIdentityValue(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : undefined;
}

export function getCandidateDisplayName(
  candidate: NormalizedPartialCandidate,
): string | undefined {
  if (candidate.fullName) {
    return candidate.fullName;
  }

  const parts = [
    candidate.firstName,
    candidate.middleName,
    candidate.lastName,
  ].filter((value): value is string => Boolean(value && value.trim()));

  if (parts.length === 0) {
    return undefined;
  }

  return parts.join(' ');
}

export function getCandidatePrimaryEmployer(
  candidate: NormalizedPartialCandidate,
): string | undefined {
  const currentExperience = candidate.experiences.find(
    (experience) => experience.isCurrent,
  );

  return currentExperience?.employer ?? candidate.experiences[0]?.employer;
}

export function getLocationFingerprint(location: Location | undefined): string | undefined {
  if (!location) {
    return undefined;
  }

  const values = [
    location.formatted,
    location.city,
    location.region,
    location.country,
    location.postalCode,
  ].filter((value): value is string => Boolean(value && value.trim()));

  if (values.length === 0) {
    return undefined;
  }

  return values.join('|');
}

export function resolveSourcePriorityLabel(
  sourceRecord: SourceRecord,
  config: MergeConfig,
): string {
  const haystacks: string[] = [
    sourceRecord.sourceType,
    sourceRecord.sourceName,
    sourceRecord.fileName,
    sourceRecord.parser,
    sourceRecord.extractor,
  ];

  for (const key of Object.keys(sourceRecord.metadata)) {
    const value = sourceRecord.metadata[key];
    if (typeof value === 'string') {
      haystacks.push(value);
    }
  }

  const normalizedHaystack = haystacks.join(' ').toLowerCase();

  for (const label of Object.keys(config.sourceMatchers)) {
    const patterns = config.sourceMatchers[label] ?? [];
    for (const pattern of patterns) {
      if (normalizedHaystack.includes(pattern.toLowerCase())) {
        return label;
      }
    }
  }

  return sourceRecord.sourceType;
}

export function getSourcePriorityRank(
  sourceRecord: SourceRecord,
  config: MergeConfig,
): number {
  const label = resolveSourcePriorityLabel(sourceRecord, config);
  const rank = config.sourcePriority.indexOf(label);
  return rank >= 0 ? rank : config.sourcePriority.length;
}

export function canonicalizeSourceRecord(sourceRecord: SourceRecord): SourceRecord {
  return createSourceRecord({
    ...sourceRecord,
    id: createDeterministicId('source-record', [
      sourceRecord.sourceId,
      sourceRecord.sourceType,
      sourceRecord.sourceName,
      sourceRecord.fileName,
      sourceRecord.mimeType,
      sourceRecord.receivedAt,
      sourceRecord.parser,
      sourceRecord.extractor,
      stableStringify(sourceRecord.metadata),
    ]),
    metadata: cloneRecord(sourceRecord.metadata),
  });
}

export function buildStableSourceRegistry(
  candidates: readonly GroupedCandidate[],
): Pick<CandidateGroup, 'sourceRecords' | 'sourceRecordLookup' | 'sourceRecordIdMap'> {
  const sourceRecords: SourceRecord[] = [];
  const sourceRecordLookup: Record<string, SourceRecord> = {};
  const sourceRecordIdMap: Record<string, string> = {};

  for (const groupedCandidate of candidates) {
    for (const sourceRecord of groupedCandidate.candidate.sourceRecords) {
      const canonicalSourceRecord = canonicalizeSourceRecord(sourceRecord);
      sourceRecordIdMap[sourceRecord.id] = canonicalSourceRecord.id;

      if (!sourceRecordLookup[canonicalSourceRecord.id]) {
        sourceRecordLookup[canonicalSourceRecord.id] = canonicalSourceRecord;
        sourceRecords.push(canonicalSourceRecord);
      }
    }
  }

  return {
    sourceRecords: Object.freeze(sourceRecords),
    sourceRecordLookup: Object.freeze(sourceRecordLookup),
    sourceRecordIdMap: Object.freeze(sourceRecordIdMap),
  };
}

export function getStableSourceRecordsForCandidate(
  groupedCandidate: GroupedCandidate,
  group: CandidateGroup,
): readonly SourceRecord[] {
  const sourceRecords: SourceRecord[] = [];

  for (const sourceRecord of groupedCandidate.candidate.sourceRecords) {
    const stableId = group.sourceRecordIdMap[sourceRecord.id] ?? sourceRecord.id;
    const stableSourceRecord = group.sourceRecordLookup[stableId];

    if (stableSourceRecord) {
      sourceRecords.push(stableSourceRecord);
    }
  }

  return Object.freeze(sourceRecords);
}

export function remapProvenanceRecords(
  provenanceRecords: readonly unknown[],
  sourceRecordIdMap: Readonly<Record<string, string>>,
): readonly Provenance[] {
  const remapped: Provenance[] = [];
  const seen = new Set<string>();

  for (const provenanceRecord of provenanceRecords) {
    const provenance = provenanceRecord as Provenance;
    const sourceRecordId =
      sourceRecordIdMap[provenance.sourceRecordId] ?? provenance.sourceRecordId;
    const winningSourceRecordIds = provenance.winningSourceRecordIds?.map(
      (sourceId) => sourceRecordIdMap[sourceId] ?? sourceId,
    );
    const candidateSourceRecordIds = provenance.candidateSourceRecordIds?.map(
      (sourceId) => sourceRecordIdMap[sourceId] ?? sourceId,
    );
    const stableId = createDeterministicId('provenance', [
      sourceRecordId,
      provenance.fieldPath,
      provenance.extractedValue ?? '',
      provenance.extractor ?? '',
      provenance.notes ?? '',
      provenance.mergeStrategy ?? '',
      stableStringify(winningSourceRecordIds ?? []),
      stableStringify(candidateSourceRecordIds ?? []),
      stableStringify(provenance.discardedValues ?? []),
      provenance.resolvedAt ?? '',
    ]);

    if (seen.has(stableId)) {
      continue;
    }

    seen.add(stableId);
    remapped.push(
      createProvenance({
        ...provenance,
        id: stableId,
        sourceRecordId,
        winningSourceRecordIds,
        candidateSourceRecordIds,
        discardedValues: provenance.discardedValues
          ? [...provenance.discardedValues]
          : undefined,
      }),
    );
  }

  return Object.freeze(remapped);
}

export function remapConfidenceScores(
  confidenceScores: readonly unknown[],
  sourceRecordIdMap: Readonly<Record<string, string>>,
): readonly ConfidenceScore[] {
  const remapped: ConfidenceScore[] = [];
  const seen = new Set<string>();

  for (const confidenceScore of confidenceScores) {
    const score = confidenceScore as ConfidenceScore;
    const sourceRecordId = score.sourceRecordId
      ? sourceRecordIdMap[score.sourceRecordId] ?? score.sourceRecordId
      : undefined;
    const stableId = createDeterministicId('confidence-score', [
      score.fieldPath,
      String(score.value),
      score.reason ?? '',
      sourceRecordId ?? '',
      score.calculatedAt ?? '',
    ]);

    if (seen.has(stableId)) {
      continue;
    }

    seen.add(stableId);
    remapped.push(
      createConfidenceScore({
        ...score,
        id: stableId,
        sourceRecordId,
      }),
    );
  }

  return Object.freeze(remapped);
}

export function mergeUniqueProvenance(
  provenanceLists: readonly (readonly Provenance[])[],
): readonly Provenance[] {
  const merged: Provenance[] = [];
  const seen = new Set<string>();

  for (const provenanceList of provenanceLists) {
    for (const provenance of provenanceList) {
      if (seen.has(provenance.id)) {
        continue;
      }

      seen.add(provenance.id);
      merged.push(provenance);
    }
  }

  return Object.freeze(merged);
}

export function mergeUniqueConfidence(
  confidenceLists: readonly (readonly ConfidenceScore[])[],
): readonly ConfidenceScore[] {
  const merged: ConfidenceScore[] = [];
  const seen = new Set<string>();

  for (const confidenceList of confidenceLists) {
    for (const confidence of confidenceList) {
      if (seen.has(confidence.id)) {
        continue;
      }

      seen.add(confidence.id);
      merged.push(confidence);
    }
  }

  return Object.freeze(merged);
}

export function mergeUniqueSourceRecordIds(
  sourceRecordIdGroups: readonly (readonly string[])[],
): readonly string[] {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const sourceRecordIds of sourceRecordIdGroups) {
    for (const sourceRecordId of sourceRecordIds) {
      if (seen.has(sourceRecordId)) {
        continue;
      }

      seen.add(sourceRecordId);
      merged.push(sourceRecordId);
    }
  }

  return Object.freeze(merged);
}

export function createFieldDecisionProvenance(input: {
  readonly groupId: string;
  readonly fieldPath: string;
  readonly strategyName: string;
  readonly winnerSourceRecordIds: readonly string[];
  readonly candidateSourceRecordIds: readonly string[];
  readonly extractedValue?: string;
  readonly discardedValues?: readonly string[];
  readonly notes?: string;
  readonly resolvedAt: string;
}): Provenance {
  const sourceRecordId =
    input.winnerSourceRecordIds[0] ?? input.candidateSourceRecordIds[0];

  return createProvenance({
    id: createDeterministicId('merge-provenance', [
      input.groupId,
      input.fieldPath,
      input.strategyName,
      sourceRecordId,
      stableStringify(input.winnerSourceRecordIds),
      stableStringify(input.candidateSourceRecordIds),
      input.extractedValue ?? '',
      stableStringify(input.discardedValues ?? []),
      input.resolvedAt,
    ]),
    sourceRecordId,
    fieldPath: input.fieldPath,
    extractedValue: input.extractedValue,
    notes: input.notes,
    winningSourceRecordIds: input.winnerSourceRecordIds,
    candidateSourceRecordIds: input.candidateSourceRecordIds,
    mergeStrategy: input.strategyName,
    discardedValues: input.discardedValues
      ? [...input.discardedValues]
      : undefined,
    resolvedAt: input.resolvedAt,
  });
}

export function calculateValueCompleteness(value: unknown): number {
  if (value === undefined || value === null) {
    return 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) {
      return 0;
    }

    return normalized.length + normalized.split(/\s+/).length * 5;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return 1;
  }

  if (Array.isArray(value)) {
    let total = value.length * 10;
    for (const item of value) {
      total += calculateValueCompleteness(item);
    }
    return total;
  }

  if (isRecord(value)) {
    let total = 0;

    for (const key of sortedKeys(value)) {
      if (TECHNICAL_ENTITY_KEYS.has(key)) {
        continue;
      }

      total += calculateValueCompleteness(value[key]);
    }

    return total;
  }

  return 1;
}

export function hasMeaningfulValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (isRecord(value)) {
    return sortedKeys(value).some(
      (key) => !TECHNICAL_ENTITY_KEYS.has(key) && hasMeaningfulValue(value[key]),
    );
  }

  return true;
}

export function isSubstantiallyMoreComplete(
  challenger: unknown,
  current: unknown,
): boolean {
  if (!hasMeaningfulValue(current)) {
    return hasMeaningfulValue(challenger);
  }

  if (typeof challenger === 'string' && typeof current === 'string') {
    const normalizedChallenger = normalizeIdentityValue(challenger);
    const normalizedCurrent = normalizeIdentityValue(current);

    return Boolean(
      normalizedChallenger &&
        normalizedCurrent &&
        normalizedChallenger.length > normalizedCurrent.length &&
        normalizedChallenger.includes(normalizedCurrent),
    );
  }

  if (isRecord(challenger) && isRecord(current)) {
    const challengerEntries = flattenSemanticEntries(challenger);
    const currentEntries = flattenSemanticEntries(current);

    let everyExistingEntryMatches = true;

    for (const key of Object.keys(currentEntries)) {
      if (challengerEntries[key] !== currentEntries[key]) {
        everyExistingEntryMatches = false;
        break;
      }
    }

    return (
      everyExistingEntryMatches &&
      Object.keys(challengerEntries).length > Object.keys(currentEntries).length
    );
  }

  return calculateValueCompleteness(challenger) > calculateValueCompleteness(current);
}

export function choosePreferredCandidate<T>(
  current: MergeFieldCandidate<T> | undefined,
  challenger: MergeFieldCandidate<T>,
): MergeFieldCandidate<T> {
  if (!current) {
    return challenger;
  }

  if (challenger.priorityRank < current.priorityRank) {
    return isSubstantiallyMoreComplete(current.value, challenger.value)
      ? current
      : challenger;
  }

  if (challenger.priorityRank > current.priorityRank) {
    return isSubstantiallyMoreComplete(challenger.value, current.value)
      ? challenger
      : current;
  }

  if (challenger.completenessScore > current.completenessScore) {
    return challenger;
  }

  if (challenger.completenessScore < current.completenessScore) {
    return current;
  }

  return compareMergeFieldCandidates(challenger, current) < 0
    ? challenger
    : current;
}

export function compareMergeFieldCandidates<T>(
  left: MergeFieldCandidate<T>,
  right: MergeFieldCandidate<T>,
): number {
  if (left.priorityRank !== right.priorityRank) {
    return left.priorityRank - right.priorityRank;
  }

  if (left.candidateIndex !== right.candidateIndex) {
    return left.candidateIndex - right.candidateIndex;
  }

  return left.sourceRecordIds.join('|').localeCompare(right.sourceRecordIds.join('|'));
}

export function serializeMergeValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return stableStringify(value);
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sanitizeComparableValue(value));
}

export function getEarliestSourceTimestamp(
  sourceRecords: readonly SourceRecord[],
): string {
  if (sourceRecords.length === 0) {
    return '1970-01-01T00:00:00.000Z';
  }

  let earliest = sourceRecords[0]!.receivedAt;

  for (let index = 1; index < sourceRecords.length; index += 1) {
    const receivedAt = sourceRecords[index]!.receivedAt;
    if (receivedAt.localeCompare(earliest) < 0) {
      earliest = receivedAt;
    }
  }

  return earliest;
}

export function getLatestSourceTimestamp(sourceRecords: readonly SourceRecord[]): string {
  if (sourceRecords.length === 0) {
    return '1970-01-01T00:00:00.000Z';
  }

  let latest = sourceRecords[0]!.receivedAt;

  for (let index = 1; index < sourceRecords.length; index += 1) {
    const receivedAt = sourceRecords[index]!.receivedAt;
    if (receivedAt.localeCompare(latest) > 0) {
      latest = receivedAt;
    }
  }

  return latest;
}

export function toComparableEndDate(value: string | undefined): string {
  return value ?? '9999-12-31';
}

export function toComparableStartDate(value: string | undefined): string {
  return value ?? '0000-01-01';
}

export function cloneRecord(
  input: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const clone: Record<string, unknown> = {};

  for (const key of sortedKeys(input)) {
    clone[key] = input[key];
  }

  return Object.freeze(clone);
}

function sanitizeComparableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeComparableValue(item));
  }

  if (isRecord(value)) {
    const sanitized: ComparableRecord = {};

    for (const key of sortedKeys(value)) {
      if (TECHNICAL_ENTITY_KEYS.has(key)) {
        continue;
      }

      sanitized[key] = sanitizeComparableValue(value[key]);
    }

    return sanitized;
  }

  return value;
}

function flattenSemanticEntries(value: ComparableRecord): ComparableRecord {
  const entries: ComparableRecord = {};
  collectSemanticEntries(value, '', entries);
  return entries;
}

function collectSemanticEntries(
  value: unknown,
  prefix: string,
  entries: ComparableRecord,
): void {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (normalized) {
      entries[prefix] = normalized.toLowerCase();
    }
    return;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    entries[prefix] = value;
    return;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      collectSemanticEntries(value[index], `${prefix}[${index}]`, entries);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const key of sortedKeys(value)) {
    if (TECHNICAL_ENTITY_KEYS.has(key)) {
      continue;
    }

    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    collectSemanticEntries(value[key], nextPrefix, entries);
  }
}

function isRecord(value: unknown): value is ComparableRecord {
  return typeof value === 'object' && value !== null;
}

function sortedKeys(value: ComparableRecord): readonly string[] {
  return Object.keys(value).sort((left, right) => left.localeCompare(right));
}
