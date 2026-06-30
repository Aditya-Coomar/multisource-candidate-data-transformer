import { config } from '../../config/config';
import logger from '../../logger';
import { CanonicalBuilder } from '../../mergers/builder/canonical.builder';
import { createMergeContext } from '../../mergers/base/merge.context';
import type { MergeConfig } from '../../mergers/base/merge.types';
import type { MergeStrategy } from '../../mergers/base/merge.interface';
import type { MergeStrategyName } from '../../mergers/base/merge.types';
import { CandidateGrouper } from '../../mergers/grouping/candidate.grouper';
import { MergePlanner } from '../../mergers/planner/merge.planner';
import { ConflictResolver } from '../../mergers/resolver/conflict.resolver';
import { ArrayMergeStrategy } from '../../mergers/strategies/array.strategy';
import { ContactMergeStrategy } from '../../mergers/strategies/contact.strategy';
import { EducationMergeStrategy } from '../../mergers/strategies/education.strategy';
import { ExperienceMergeStrategy } from '../../mergers/strategies/experience.strategy';
import { ScalarMergeStrategy } from '../../mergers/strategies/scalar.strategy';
import { SocialMergeStrategy } from '../../mergers/strategies/social.strategy';
import type { CanonicalCandidate, NormalizedPartialCandidate } from '../../models';

export class MergeStage {
  private readonly mergeConfig: MergeConfig;
  private readonly strategyRegistry: Readonly<
    Record<MergeStrategyName, MergeStrategy>
  >;
  private readonly candidateGrouper: CandidateGrouper;
  private readonly mergePlanner: MergePlanner;
  private readonly conflictResolver: ConflictResolver;
  private readonly canonicalBuilder: CanonicalBuilder;

  constructor(mergeConfig?: Partial<MergeConfig>) {
    this.mergeConfig = Object.freeze({
      sourcePriority:
        mergeConfig?.sourcePriority ?? [...config.merge.sourcePriority],
      sourceMatchers:
        mergeConfig?.sourceMatchers ?? { ...config.merge.sourceMatchers },
      identityFallbackEnabled:
        mergeConfig?.identityFallbackEnabled ??
        config.merge.identityFallbackEnabled,
    });
    this.candidateGrouper = new CandidateGrouper(this.mergeConfig);
    this.mergePlanner = new MergePlanner(this.mergeConfig);
    this.strategyRegistry = Object.freeze({
      scalar: new ScalarMergeStrategy(),
      array: new ArrayMergeStrategy(),
      experience: new ExperienceMergeStrategy(),
      education: new EducationMergeStrategy(),
      contact: new ContactMergeStrategy(),
      social: new SocialMergeStrategy(),
    });
    this.conflictResolver = new ConflictResolver(
      this.strategyRegistry,
    );
    this.canonicalBuilder = new CanonicalBuilder();
  }

  async execute(
    candidates: readonly NormalizedPartialCandidate[],
  ): Promise<readonly CanonicalCandidate[]> {
    logger.info('merge.started', {
      candidateCount: candidates.length,
    });

    const groups = this.candidateGrouper.group(candidates);
    logger.debug('merge.groups.created', {
      groupCount: groups.length,
    });

    const canonicalCandidates: CanonicalCandidate[] = [];

    for (const group of groups) {
      const mergePlan = this.mergePlanner.plan(group);
      const mergeContext = createMergeContext({
        currentGroup: group,
        mergePlan,
        config: this.mergeConfig,
        strategies: this.strategyRegistry,
      });
      const resolvedFields = this.conflictResolver.resolve(mergeContext);
      const canonicalCandidate = this.canonicalBuilder.build(
        mergeContext,
        resolvedFields,
      );
      canonicalCandidates.push(canonicalCandidate);

      logger.info('merge.canonical.created', {
        groupId: group.groupId,
        sourceCount: group.sourceRecords.length,
        conflictCount: mergePlan.conflictCount,
      });
    }

    logger.info('merge.completed', {
      candidateCount: candidates.length,
      canonicalCount: canonicalCandidates.length,
      groupCount: groups.length,
    });

    return Object.freeze(canonicalCandidates);
  }
}
