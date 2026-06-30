import {
  buildStableSourceRegistry,
  createDeterministicId,
  getCandidateDisplayName,
  getLocationFingerprint,
} from '../base/merge.context';
import type {
  CandidateGroup,
  GroupedCandidate,
  MergeConfig,
} from '../base/merge.types';
import type { NormalizedPartialCandidate } from '../../models';
import { IdentityResolver } from '../identity/identity.resolver';

export class CandidateGrouper {
  private readonly identityResolver: IdentityResolver;

  constructor(private readonly config: MergeConfig) {
    this.identityResolver = new IdentityResolver(config);
  }

  group(
    candidates: readonly NormalizedPartialCandidate[],
  ): readonly CandidateGroup[] {
    const parent = candidates.map((_, index) => index);
    const identityKeysByIndex: string[][] = candidates.map(() => []);
    const firstSeenByIdentityKey = new Map<string, number>();

    for (let index = 0; index < candidates.length; index += 1) {
      const identity = this.identityResolver.resolve(candidates[index]!);
      identityKeysByIndex[index] = [...identity.keys];

      for (const key of identity.keys) {
        const firstSeenIndex = firstSeenByIdentityKey.get(key);

        if (firstSeenIndex === undefined) {
          firstSeenByIdentityKey.set(key, index);
          continue;
        }

        this.union(parent, index, firstSeenIndex);
      }
    }

    const groupsByRoot = new Map<number, GroupedCandidate[]>();
    const groupKeysByRoot = new Map<number, Set<string>>();

    for (let index = 0; index < candidates.length; index += 1) {
      const root = this.find(parent, index);
      const groupedCandidates = groupsByRoot.get(root) ?? [];
      groupedCandidates.push(
        Object.freeze({
          candidate: candidates[index]!,
          candidateIndex: index,
        }),
      );
      groupsByRoot.set(root, groupedCandidates);

      const identityKeySet = groupKeysByRoot.get(root) ?? new Set<string>();
      for (const key of identityKeysByIndex[index] ?? []) {
        identityKeySet.add(key);
      }
      groupKeysByRoot.set(root, identityKeySet);
    }

    const groups: CandidateGroup[] = [];
    const sortedRoots = [...groupsByRoot.keys()].sort((left, right) => left - right);

    for (const root of sortedRoots) {
      const groupedCandidates = Object.freeze([...(groupsByRoot.get(root) ?? [])]);
      const identityKeySet = groupKeysByRoot.get(root) ?? new Set<string>();
      const identityKeys = Object.freeze([...identityKeySet].sort());
      const stableSourceRegistry = buildStableSourceRegistry(groupedCandidates);

      groups.push(
        Object.freeze({
          groupId: this.createGroupId(groupedCandidates, identityKeys),
          identityKeys,
          candidates: groupedCandidates,
          sourceRecords: stableSourceRegistry.sourceRecords,
          sourceRecordLookup: stableSourceRegistry.sourceRecordLookup,
          sourceRecordIdMap: stableSourceRegistry.sourceRecordIdMap,
        }),
      );
    }

    return Object.freeze(groups);
  }

  private createGroupId(
    groupedCandidates: readonly GroupedCandidate[],
    identityKeys: readonly string[],
  ): string {
    const parts =
      identityKeys.length > 0
        ? [...identityKeys]
        : this.createFallbackGroupFingerprint(groupedCandidates);

    return createDeterministicId('candidate-group', parts);
  }

  private createFallbackGroupFingerprint(
    groupedCandidates: readonly GroupedCandidate[],
  ): readonly string[] {
    const parts: string[] = [];

    for (const groupedCandidate of groupedCandidates) {
      const candidate = groupedCandidate.candidate;
      const name = getCandidateDisplayName(candidate) ?? 'unknown-name';
      const location = getLocationFingerprint(candidate.location) ?? 'unknown-location';

      parts.push(`candidate-index:${groupedCandidate.candidateIndex}`);
      parts.push(`candidate-name:${name}`);
      parts.push(`candidate-location:${location}`);

      for (const sourceRecord of candidate.sourceRecords) {
        parts.push(`source:${sourceRecord.sourceId}`);
      }
    }

    return Object.freeze(parts);
  }

  private find(parent: number[], index: number): number {
    if (parent[index] === index) {
      return index;
    }

    parent[index] = this.find(parent, parent[index]!);
    return parent[index]!;
  }

  private union(parent: number[], left: number, right: number): void {
    const leftRoot = this.find(parent, left);
    const rightRoot = this.find(parent, right);

    if (leftRoot === rightRoot) {
      return;
    }

    if (leftRoot < rightRoot) {
      parent[rightRoot] = leftRoot;
      return;
    }

    parent[leftRoot] = rightRoot;
  }
}
