import type { ProjectionConfig } from '../../models';
import type { ProjectionFieldSelection } from '../../models/projection-config';
import type { ProjectionPlan } from '../base/projector.types';
import { AliasMapper } from '../mapper/alias.mapper';

const DEFAULT_OUTPUT_FIELDS: readonly ProjectionFieldSelection[] = Object.freeze([
  { path: 'candidate_id', from: 'candidate_id', type: 'string', required: true },
  { path: 'full_name', from: 'fullName', type: 'string', required: true },
  { path: 'emails', from: 'emails', type: 'string[]' },
  { path: 'phones', from: 'phones', type: 'string[]', normalize: 'E164' },
  { path: 'location', from: 'location', type: 'object' },
  { path: 'links', from: 'links', type: 'object' },
  { path: 'headline', from: 'headline', type: 'string' },
  { path: 'years_experience', from: 'years_experience', type: 'number' },
  { path: 'skills', from: 'ats_skills', type: 'object[]', normalize: 'canonical' },
  { path: 'experience', from: 'ats_experience', type: 'object[]' },
  { path: 'education', from: 'ats_education', type: 'object[]' },
  { path: 'provenance', from: 'ats_provenance', type: 'object[]' },
  { path: 'overall_confidence', from: 'overall_confidence', type: 'number' },
]);

export class ProjectionPlanner {
  constructor(private readonly aliasMapper = new AliasMapper()) {}

  build(config: ProjectionConfig): ProjectionPlan {
    const usesDefaultFields =
      config.fields.length === 0 && config.computedFields.length === 0;
    const selections = usesDefaultFields
      ? [...DEFAULT_OUTPUT_FIELDS]
      : [...config.fields, ...config.computedFields];
    const seen = new Set<string>();
    const fieldSelections = selections.filter((selection) => {
      const sourcePath = getSourcePath(selection);
      const outputPath = getOutputPath(selection, config, this.aliasMapper);
      const key = `${sourcePath}->${outputPath}`;

      if (
        config.exclude.includes(sourcePath) ||
        config.exclude.includes(outputPath) ||
        seen.has(key)
      ) {
        return false;
      }

      seen.add(key);
      return true;
    });

    return Object.freeze({
      fields: Object.freeze(
        fieldSelections.map((selection) => {
          const sourcePath = getSourcePath(selection);
          const outputPath = getOutputPath(selection, config, this.aliasMapper);

          return (
          Object.freeze({
            sourcePath,
            outputPath,
            formatting: {
              ...config.formatting[sourcePath],
              ...config.formatting[outputPath],
              ...(typeof selection === 'object' && selection.normalize
                ? { normalize: selection.normalize }
                : {}),
            },
            computed:
              typeof selection === 'string' &&
              config.computedFields.includes(selection),
            required:
              typeof selection === 'object' ? selection.required ?? false : false,
            type: typeof selection === 'object' ? selection.type : undefined,
          })
          );
        }),
      ),
      missingValuePolicy: usesDefaultFields ? 'null' : config.missingValuePolicy,
      includeConfidence: config.includeConfidence,
      includeProvenance: config.includeProvenance,
      includeSourceRecords: config.includeSourceRecords,
    });
  }
}

function getSourcePath(selection: ProjectionFieldSelection): string {
  return typeof selection === 'string' ? selection : selection.from ?? selection.path;
}

function getOutputPath(
  selection: ProjectionFieldSelection,
  config: ProjectionConfig,
  aliasMapper: AliasMapper,
): string {
  if (typeof selection === 'object') {
    return selection.path;
  }

  return aliasMapper.map(selection, config.rename);
}
