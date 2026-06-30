import type { MergeContext } from './merge.context';
import type { MergeFieldPlan, MergeFieldPath, ResolvedField } from './merge.types';

export interface MergeStrategy<T = unknown> {
  readonly name: string;
  merge(
    fieldPlan: MergeFieldPlan<T> & { readonly fieldPath: MergeFieldPath },
    context: MergeContext,
  ): ResolvedField<T>;
}
