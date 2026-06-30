import type { CanonicalCandidate } from '../../models';

export class FieldResolver {
  resolve(candidate: CanonicalCandidate, fieldPath: string): unknown {
    if (!fieldPath) {
      return undefined;
    }

    const atsValue = resolveAtsField(candidate, fieldPath);
    if (atsValue !== undefined) {
      return atsValue;
    }

    if (fieldPath.includes('[]')) {
      return resolveWildcardPath(candidate, fieldPath);
    }

    const normalizedPath = fieldPath.replace(/\[(\d+)\]/g, '.$1');
    const segments = normalizedPath.split('.').filter(Boolean);

    let current: unknown = candidate;

    for (const segment of segments) {
      if (current === undefined || current === null) {
        return undefined;
      }

      if (Array.isArray(current)) {
        const index = Number(segment);
        current = Number.isInteger(index) ? current[index] : undefined;
        continue;
      }

      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[segment];
        continue;
      }

      return undefined;
    }

    return current;
  }
}

function resolveAtsField(
  candidate: CanonicalCandidate,
  fieldPath: string,
): unknown {
  const emailIndex = fieldPath.match(/^emails\[(\d+)\]$/);
  if (emailIndex) {
    const emails = resolveAtsField(candidate, 'emails') as readonly string[];
    return emails[Number(emailIndex[1])];
  }

  const phoneIndex = fieldPath.match(/^phones\[(\d+)\]$/);
  if (phoneIndex) {
    const phones = resolveAtsField(candidate, 'phones') as readonly string[];
    return phones[Number(phoneIndex[1])];
  }

  switch (fieldPath) {
    case 'candidate_id':
      return candidate.id;
    case 'full_name':
      return candidate.fullName;
    case 'emails':
      return candidate.contactInfo
        .filter((contact) => contact.kind === 'email')
        .map((contact) => contact.value);
    case 'phones':
      return candidate.contactInfo
        .filter((contact) => contact.kind === 'phone')
        .map((contact) => contact.value);
    case 'links':
      return buildLinks(candidate);
    case 'years_experience':
      return estimateYearsExperience(candidate);
    case 'ats_skills':
      return candidate.skills.map((skill) => ({
        name: skill.name,
        confidence: pickEntityConfidence(skill.confidence),
        sources: pickEntitySources(
          candidate,
          skill.provenance as readonly { sourceRecordId: string; sourceName?: string }[],
          'skills',
        ),
      }));
    case 'ats_experience':
      return candidate.experiences.map((experience) => ({
        company: experience.employer,
        title: experience.title ?? null,
        start: experience.startDate ?? null,
        end: experience.isCurrent ? null : (experience.endDate ?? null),
        summary: experience.description ?? null,
      }));
    case 'ats_education':
      return candidate.education.map((education) => ({
        institution: education.institution,
        degree: education.degree ?? null,
        field: education.fieldOfStudy ?? null,
        end_year: education.endDate?.slice(0, 4) ?? null,
      }));
    case 'ats_provenance':
      return candidate.provenance.map((entry) => ({
        field: toOutputField(entry.fieldPath),
        source: entry.sourceName ?? lookupSourceName(candidate, entry.sourceRecordId),
        method: entry.normalizer ?? entry.mergeStrategy ?? entry.extractor ?? 'deterministic',
      }));
    case 'overall_confidence':
      return pickOverallConfidence(candidate);
    default:
      return undefined;
  }
}

function resolveWildcardPath(root: unknown, fieldPath: string): unknown {
  const [arrayPath, nestedPath = ''] = fieldPath.split('[]');
  const arrayValue = resolvePlainPath(root, arrayPath);

  if (!Array.isArray(arrayValue)) {
    return undefined;
  }

  const suffix = nestedPath.replace(/^\./, '');
  if (!suffix) {
    return arrayValue;
  }

  return arrayValue
    .map((entry) => resolvePlainPath(entry, suffix))
    .filter((entry) => entry !== undefined);
}

function resolvePlainPath(root: unknown, path: string): unknown {
  const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
  const segments = normalizedPath.split('.').filter(Boolean);
  let current = root;

  for (const segment of segments) {
    if (current === undefined || current === null) {
      return undefined;
    }

    if (Array.isArray(current)) {
      const index = Number(segment);
      current = Number.isInteger(index) ? current[index] : undefined;
      continue;
    }

    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[segment];
      continue;
    }

    return undefined;
  }

  return current;
}

function buildLinks(candidate: CanonicalCandidate): Record<string, unknown> {
  const links: Record<string, unknown> = {
    linkedin: null,
    github: null,
    portfolio: null,
    other: [],
  };

  for (const link of candidate.socialLinks) {
    if (link.platform === 'linkedin' || link.platform === 'github' || link.platform === 'portfolio') {
      links[link.platform] ??= link.url;
      continue;
    }

    (links.other as string[]).push(link.url);
  }

  return links;
}

function estimateYearsExperience(candidate: CanonicalCandidate): number | null {
  const ranges = candidate.experiences
    .map((experience) => {
      const startYear = parseYear(experience.startDate);
      if (!startYear) {
        return undefined;
      }

      return {
        startYear,
        endYear:
          experience.isCurrent || !experience.endDate
            ? new Date().getUTCFullYear()
            : (parseYear(experience.endDate) ?? startYear),
      };
    })
    .filter((range): range is { startYear: number; endYear: number } => Boolean(range));

  if (ranges.length === 0) {
    return null;
  }

  let totalYears = 0;
  for (const range of ranges) {
    totalYears += Math.max(0, range.endYear - range.startYear);
  }

  return Number(totalYears.toFixed(1));
}

function parseYear(value: string | undefined): number | undefined {
  const year = value?.match(/\d{4}/)?.[0];
  return year ? Number(year) : undefined;
}

function pickEntityConfidence(
  confidence: readonly unknown[],
): number | null {
  const first = confidence[0];
  return isConfidenceLike(first) ? first.value : null;
}

function pickEntitySources(
  candidate: CanonicalCandidate,
  provenance: readonly { sourceRecordId: string; sourceName?: string }[],
  fallbackField: string,
): readonly string[] {
  const names = provenance
    .map((entry) => entry.sourceName ?? lookupSourceName(candidate, entry.sourceRecordId))
    .filter((source): source is string => Boolean(source));

  if (names.length > 0) {
    return Object.freeze([...new Set(names)]);
  }

  const fieldSources = candidate.provenance
    .filter((entry) => entry.fieldPath === fallbackField)
    .map((entry) => entry.sourceName ?? lookupSourceName(candidate, entry.sourceRecordId))
    .filter((source): source is string => Boolean(source));

  if (fieldSources.length > 0) {
    return Object.freeze([...new Set(fieldSources)]);
  }

  return Object.freeze(candidate.sourceRecords.map((record) => record.sourceName));
}

function lookupSourceName(
  candidate: CanonicalCandidate,
  sourceRecordId: string | undefined,
): string | undefined {
  return candidate.sourceRecords.find((record) => record.id === sourceRecordId)?.sourceName;
}

function pickOverallConfidence(candidate: CanonicalCandidate): number {
  const overall = candidate.confidence.find((entry) => entry.fieldPath === 'overall');
  if (overall) {
    return overall.value;
  }

  if (candidate.confidence.length === 0) {
    return 0;
  }

  const total = candidate.confidence.reduce((sum, entry) => sum + entry.value, 0);
  return Number((total / candidate.confidence.length).toFixed(4));
}

function toOutputField(fieldPath: string): string {
  const mapping: Record<string, string> = {
    id: 'candidate_id',
    fullName: 'full_name',
    contactInfo: 'emails/phones',
    socialLinks: 'links',
    experiences: 'experience',
    skills: 'skills',
    confidence: 'overall_confidence',
  };

  return mapping[fieldPath] ?? fieldPath;
}

function isConfidenceLike(value: unknown): value is { value: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).value === 'number'
  );
}
