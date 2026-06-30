import logger from '../logger';
import type { CanonicalCandidate, ProjectionConfig } from '../models';
import type { Projector } from './base/projector.interface';
import { OutputBuilder } from './builders/output.builder';
import { ComputedFieldEngine } from './computed/computed-field.engine';
import { FieldMapper } from './mapper/field.mapper';
import { ProjectionPlanner } from './planner/projection.planner';
import { ConfidencePolicyEngine } from './policies/confidence.policy';
import { MissingPolicyEngine } from './policies/missing.policy';
import { ProvenancePolicyEngine } from './policies/provenance.policy';
import { FieldResolver } from './resolver/field.resolver';

export class ProjectionEngine
  implements Projector<Readonly<Record<string, unknown>>>
{
  private readonly planner = new ProjectionPlanner();
  private readonly resolver = new FieldResolver();
  private readonly computedFieldEngine = new ComputedFieldEngine();
  private readonly missingPolicyEngine = new MissingPolicyEngine();
  private readonly confidencePolicyEngine = new ConfidencePolicyEngine();
  private readonly provenancePolicyEngine = new ProvenancePolicyEngine();
  private readonly outputBuilder = new OutputBuilder();
  private readonly fieldMapper = new FieldMapper(this.outputBuilder);

  project(
    candidate: CanonicalCandidate,
    config: ProjectionConfig,
  ): Readonly<Record<string, unknown>> {
    logger.info('projection.started', {
      candidateId: candidate.id,
      fieldCount: config.fields.length + config.computedFields.length,
    });

    const plan = this.planner.build(config);
    const output = this.outputBuilder.create();
    const confidence: Record<string, unknown> = {};
    const provenance: Record<string, unknown> = {};

    for (const field of plan.fields) {
      const rawValue = field.computed
        ? this.computedFieldEngine.compute(candidate, field.sourcePath)
        : this.resolver.resolve(candidate, field.sourcePath);
      const formattedValue = this.formatValue(rawValue, field.formatting);
      const decision = this.missingPolicyEngine.apply(
        field.sourcePath,
        formattedValue,
        plan.missingValuePolicy,
      );

      if (!decision.include) {
        logger.warn('projection.field.omitted', {
          candidateId: candidate.id,
          field: field.sourcePath,
        });
        continue;
      }

      this.fieldMapper.map(output, {
        sourcePath: field.sourcePath,
        outputPath: field.outputPath,
        value: decision.value,
        formatting: field.formatting,
      });

      if (plan.includeConfidence) {
        confidence[field.outputPath] = this.confidencePolicyEngine.inject(
          candidate,
          field.outputPath,
          field.sourcePath,
        );
      }

      if (plan.includeProvenance) {
        provenance[field.outputPath] = this.provenancePolicyEngine.inject(
          candidate,
          field.outputPath,
          field.sourcePath,
        );
      }

      logger.debug('projection.field.resolved', {
        candidateId: candidate.id,
        field: field.sourcePath,
        outputField: field.outputPath,
      });
    }

    if (plan.includeConfidence) {
      output.confidence = Object.freeze({ ...confidence });
    }

    if (plan.includeProvenance) {
      output.provenance = Object.freeze({ ...provenance });
    }

    if (plan.includeSourceRecords) {
      output.sourceRecords = candidate.sourceRecords;
    }

    logger.info('projection.completed', {
      candidateId: candidate.id,
      projectedFieldCount: Object.keys(output).length,
    });

    return Object.freeze(
      sanitizeForJson(output) as Readonly<Record<string, unknown>>,
    );
  }

  private formatValue(
    value: unknown,
    formatting: ProjectionConfig['formatting'][string] | undefined,
  ): unknown {
    if (!formatting || value === undefined || value === null) {
      return value;
    }

    if (formatting.normalize === 'canonical') {
      if (Array.isArray(value)) {
        return value.map((entry) =>
          typeof entry === 'string' ? canonicalizeSkillName(entry) : entry,
        );
      }

      if (typeof value === 'string') {
        return canonicalizeSkillName(value);
      }
    }

    if (formatting.normalize === 'E164' || formatting.normalize === 'e164') {
      if (Array.isArray(value)) {
        return value.map((entry) =>
          typeof entry === 'string' ? entry.replace(/[^\d+]/g, '') : entry,
        );
      }

      if (typeof value === 'string') {
        return value.replace(/[^\d+]/g, '');
      }
    }

    if (formatting.location && typeof value === 'object' && !Array.isArray(value)) {
      const location = value as Record<string, unknown>;

      if (formatting.location === 'iso-country') {
        return location.country;
      }

      return [
        location.city,
        location.region,
        location.country,
      ]
        .filter((segment): segment is string => typeof segment === 'string' && segment.length > 0)
        .join(', ');
    }

    if (formatting.phone && typeof value === 'string') {
      return formatting.phone === 'e164'
        ? value.replace(/[^\d+]/g, '')
        : value;
    }

    if (formatting.date && typeof value === 'string') {
      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        return value;
      }

      if (formatting.date === 'yyyy') {
        return String(date.getUTCFullYear());
      }

      if (formatting.date === 'mm/yyyy') {
        return `${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`;
      }

      return date.toISOString();
    }

    if (formatting.array === 'comma-separated' && Array.isArray(value)) {
      const joinWith = formatting.joinWith ?? ', ';
      return value.map((entry) => this.stringifyArrayValue(entry)).join(joinWith);
    }

    return value;
  }

  private stringifyArrayValue(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;

      for (const key of ['name', 'value', 'label', 'title', 'employer']) {
        const candidateValue = record[key];

        if (typeof candidateValue === 'string' && candidateValue.length > 0) {
          return candidateValue;
        }
      }
    }

    return JSON.stringify(value);
  }
}

function canonicalizeSkillName(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  const aliases: Record<string, string> = {
    js: 'JavaScript',
    javascript: 'JavaScript',
    ts: 'TypeScript',
    typescript: 'TypeScript',
    node: 'Node.js',
    nodejs: 'Node.js',
    'node.js': 'Node.js',
    reactjs: 'React',
    'react.js': 'React',
    react: 'React',
    postgres: 'PostgreSQL',
    postgresql: 'PostgreSQL',
    golang: 'Go',
    k8s: 'Kubernetes',
    py: 'Python',
  };
  const alias = aliases[trimmed.toLowerCase()];

  if (alias) {
    return alias;
  }

  return trimmed
    .split(/\s+/)
    .map((segment) =>
      segment ? `${segment[0]!.toUpperCase()}${segment.slice(1).toLowerCase()}` : segment,
    )
    .join(' ');
}

function sanitizeForJson(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return Object.freeze(
      value
        .map((entry) => sanitizeForJson(entry))
        .filter((entry) => entry !== undefined),
    );
  }

  if (typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(value)) {
      const normalizedEntry = sanitizeForJson(entry);

      if (normalizedEntry !== undefined) {
        sanitized[key] = normalizedEntry;
      }
    }

    return Object.freeze(sanitized);
  }

  return String(value);
}
