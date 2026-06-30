import { MalformedInputError } from '../../errors';
import { createContactInfo } from '../../models/contact-info';
import { createEducation } from '../../models/education';
import { createExperience } from '../../models/experience';
import { createLocation } from '../../models/location';
import { createPartialCandidate } from '../../models/partial-candidate';
import { createSkill } from '../../models/skill';
import { createSocialLink } from '../../models/social-link';
import type { PartialCandidate } from '../../models/partial-candidate';
import type { Extractor } from '../base/extractor.interface';
import type { IngestionSource, ParsedContent, ParsedJsonContent } from '../base/extractor.types';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toStringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => toStringValue(item))
      .filter((item): item is string => Boolean(item));
  }

  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/[;,|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function getNestedRecord(record: JsonRecord, keys: readonly string[]): JsonRecord | undefined {
  for (const key of keys) {
    const value = record[key];
    if (isRecord(value)) {
      return value;
    }
  }

  return undefined;
}

function getRecordArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function getCandidates(data: unknown): JsonRecord[] {
  if (Array.isArray(data)) {
    return data.filter(isRecord);
  }

  if (isRecord(data) && Array.isArray(data.candidates)) {
    return data.candidates.filter(isRecord);
  }

  if (isRecord(data)) {
    return [data];
  }

  return [];
}

export class AtsJsonExtractor implements Extractor<ParsedJsonContent> {
  public readonly name = 'AtsJsonExtractor';

  supports(source: IngestionSource, parsedContent: ParsedContent): boolean {
    return parsedContent.kind === 'json' && source.sourceType === 'ats';
  }

  async extract(parsedContent: ParsedJsonContent): Promise<readonly PartialCandidate[]> {
    const records = getCandidates(parsedContent.data);

    if (records.length === 0) {
      throw new MalformedInputError('ATS JSON source does not contain candidates.', {
        source: 'json',
      });
    }

    return records.map((record) => {
      const emails = toStringArray(record.email ?? record.emails);
      const phones = toStringArray(record.phone ?? record.phones);
      const skills = toStringArray(record.skills);
      const location = getNestedRecord(record, ['location', 'address']);
      const links = getNestedRecord(record, ['links', 'profiles', 'urls']);
      const experiences = getRecordArray(record.experience ?? record.experiences ?? record.jobs);
      const education = getRecordArray(record.education ?? record.schools);

      return createPartialCandidate({
        firstName: toStringValue(record.firstName ?? record.first_name),
        lastName: toStringValue(record.lastName ?? record.last_name),
        fullName: (() => {
          const directFullName = toStringValue(record.fullName ?? record.full_name);
          if (directFullName) {
            return directFullName;
          }

          const joinedName = [
            toStringValue(record.firstName ?? record.first_name),
            toStringValue(record.lastName ?? record.last_name),
          ]
            .filter(Boolean)
            .join(' ');

          return joinedName || undefined;
        })(),
        headline: toStringValue(record.headline ?? record.title),
        summary: toStringValue(record.summary ?? record.profileSummary),
        location:
          location ||
          toStringValue(record.location) ||
          toStringValue(record.address)
            ? createLocation({
                raw: toStringValue(record.location) ?? toStringValue(record.address),
                city: location ? toStringValue(location.city) : undefined,
                region: location ? toStringValue(location.region ?? location.state) : undefined,
                country: location ? toStringValue(location.country) : undefined,
                formatted:
                  location && toStringValue(location.formatted)
                    ? toStringValue(location.formatted)
                    : toStringValue(record.location),
              })
            : undefined,
        contactInfo: [
          ...emails.map((value, index) =>
            createContactInfo({
              kind: 'email',
              value,
              isPrimary: index === 0,
            }),
          ),
          ...phones.map((value, index) =>
            createContactInfo({
              kind: 'phone',
              value,
              isPrimary: emails.length === 0 && index === 0,
            }),
          ),
        ],
        socialLinks: [
          ...[
            ['linkedin', links?.linkedin ?? record.linkedin],
            ['github', links?.github ?? record.github],
            ['portfolio', links?.portfolio ?? record.portfolio ?? record.website],
          ].flatMap(([platform, value]) => {
            const url = toStringValue(value);
            return url
              ? [
                  createSocialLink({
                    platform: platform as 'linkedin' | 'github' | 'portfolio',
                    url,
                  }),
                ]
              : [];
          }),
        ],
        experiences: experiences.map((experience) =>
          createExperience({
            employer:
              toStringValue(experience.company ?? experience.employer ?? experience.organization) ??
              'Unknown Employer',
            title: toStringValue(experience.title ?? experience.role),
            description: toStringValue(experience.summary ?? experience.description),
            startDate: toStringValue(experience.start ?? experience.startDate),
            endDate: toStringValue(experience.end ?? experience.endDate),
            isCurrent: Boolean(experience.isCurrent ?? experience.current),
          }),
        ),
        education: education.map((entry) =>
          createEducation({
            institution:
              toStringValue(entry.institution ?? entry.school ?? entry.university) ??
              'Unknown Institution',
            degree: toStringValue(entry.degree),
            fieldOfStudy: toStringValue(entry.field ?? entry.major ?? entry.fieldOfStudy),
            endDate: toStringValue(entry.endYear ?? entry.graduationYear ?? entry.endDate),
          }),
        ),
        skills: skills.map((name) => createSkill({ name })),
        additionalData: Object.freeze({ rawRecord: record }),
      });
    });
  }
}
