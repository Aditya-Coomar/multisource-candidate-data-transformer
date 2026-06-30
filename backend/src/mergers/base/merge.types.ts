import type {
  ContactInfo,
  Education,
  Experience,
  Location,
  NormalizedPartialCandidate,
  Provenance,
  Skill,
  SocialLink,
  SourceRecord,
} from '../../models';

export interface MergeFieldValueMap {
  firstName: string | undefined;
  middleName: string | undefined;
  lastName: string | undefined;
  fullName: string | undefined;
  headline: string | undefined;
  summary: string | undefined;
  location: Location | undefined;
  contactInfo: readonly ContactInfo[];
  socialLinks: readonly SocialLink[];
  experiences: readonly Experience[];
  education: readonly Education[];
  skills: readonly Skill[];
  tags: readonly string[];
  additionalData: Readonly<Record<string, unknown>>;
}

export type MergeFieldPath = keyof MergeFieldValueMap;

export const MERGE_FIELD_PATHS: readonly MergeFieldPath[] = Object.freeze([
  'firstName',
  'middleName',
  'lastName',
  'fullName',
  'headline',
  'summary',
  'location',
  'contactInfo',
  'socialLinks',
  'experiences',
  'education',
  'skills',
  'tags',
  'additionalData',
]);

export type MergeStrategyName =
  | 'scalar'
  | 'array'
  | 'experience'
  | 'education'
  | 'contact'
  | 'social';

export interface MergeConfig {
  readonly sourcePriority: readonly string[];
  readonly sourceMatchers: Readonly<Record<string, readonly string[]>>;
  readonly identityFallbackEnabled: boolean;
}

export interface CandidateIdentity {
  readonly keys: readonly string[];
  readonly matchedBy: readonly string[];
}

export interface GroupedCandidate {
  readonly candidate: NormalizedPartialCandidate;
  readonly candidateIndex: number;
}

export interface CandidateGroup {
  readonly groupId: string;
  readonly identityKeys: readonly string[];
  readonly candidates: readonly GroupedCandidate[];
  readonly sourceRecords: readonly SourceRecord[];
  readonly sourceRecordLookup: Readonly<Record<string, SourceRecord>>;
  readonly sourceRecordIdMap: Readonly<Record<string, string>>;
}

export interface MergeFieldCandidate<T = unknown> {
  readonly value: T;
  readonly sourceRecords: readonly SourceRecord[];
  readonly sourceRecordIds: readonly string[];
  readonly sourcePriorityLabel: string;
  readonly priorityRank: number;
  readonly candidateIndex: number;
  readonly completenessScore: number;
}

export interface MergeFieldPlan<T = unknown> {
  readonly fieldPath: MergeFieldPath;
  readonly strategyName: MergeStrategyName;
  readonly candidates: readonly MergeFieldCandidate<T>[];
  readonly missingSourceIds: readonly string[];
  readonly hasConflict: boolean;
}

export interface MergePlan {
  readonly groupId: string;
  readonly sourcePriority: readonly string[];
  readonly fields: Readonly<Record<MergeFieldPath, MergeFieldPlan>>;
  readonly allSourceRecordIds: readonly string[];
  readonly conflictCount: number;
}

export interface MergeMetrics {
  readonly candidateCount: number;
  readonly sourceRecordCount: number;
  readonly fieldCount: number;
  readonly conflictCount: number;
}

export interface ResolvedField<T = unknown> {
  readonly fieldPath: MergeFieldPath;
  readonly strategyName: MergeStrategyName;
  readonly value?: T;
  readonly winnerSourceRecordIds: readonly string[];
  readonly candidateSourceRecordIds: readonly string[];
  readonly discardedValues: readonly string[];
  readonly provenance: readonly Provenance[];
}

export type MergeResolvedFields = Readonly<
  Record<MergeFieldPath, ResolvedField | undefined>
>;
