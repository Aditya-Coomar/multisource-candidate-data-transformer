import type { ProjectionConfig } from '../../models';
import type { ProjectionPlan } from '../base/projector.types';
import { AliasMapper } from '../mapper/alias.mapper';

export class ProjectionPlanner {
  constructor(private readonly aliasMapper = new AliasMapper()) {}

  build(config: ProjectionConfig): ProjectionPlan {
    const fieldPaths = [...config.fields, ...config.computedFields].filter(
      (fieldPath, index, values) =>
        !config.exclude.includes(fieldPath) && values.indexOf(fieldPath) === index,
    );

    return Object.freeze({
      fields: Object.freeze(
        fieldPaths.map((fieldPath) =>
          Object.freeze({
            sourcePath: fieldPath,
            outputPath: this.aliasMapper.map(fieldPath, config.rename),
            formatting: config.formatting[fieldPath],
            computed: config.computedFields.includes(fieldPath),
          }),
        ),
      ),
      missingValuePolicy: config.missingValuePolicy,
      includeConfidence: config.includeConfidence,
      includeProvenance: config.includeProvenance,
      includeSourceRecords: config.includeSourceRecords,
    });
  }
}
