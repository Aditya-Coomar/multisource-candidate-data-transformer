import { createContactInfo } from '../../models/contact-info';
import { createEducation } from '../../models/education';
import { createExperience } from '../../models/experience';
import { createLocation } from '../../models/location';
import { createPartialCandidate } from '../../models/partial-candidate';
import { createSkill } from '../../models/skill';
import { createSocialLink } from '../../models/social-link';
import type { PartialCandidate } from '../../models/partial-candidate';
import type { Extractor } from '../base/extractor.interface';
import type { IngestionSource, ParsedContent, ParsedCsvContent } from '../base/extractor.types';

function readRowValue(row: Record<string, string>, aliases: readonly string[]): string | undefined {
  const normalizedEntries = Object.entries(row).map(([key, value]) => [
    key.trim().toLowerCase(),
    value,
  ] as const);

  for (const alias of aliases) {
    const match = normalizedEntries.find(([key]) => key === alias);
    if (match && match[1].trim()) {
      return match[1].trim();
    }
  }

  return undefined;
}

function splitValues(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export class CsvExtractor implements Extractor<ParsedCsvContent> {
  public readonly name = 'CsvExtractor';

  supports(source: IngestionSource, parsedContent: ParsedContent): boolean {
    return parsedContent.kind === 'csv' && source.fileName.toLowerCase().endsWith('.csv');
  }

  async extract(parsedContent: ParsedCsvContent): Promise<readonly PartialCandidate[]> {
    return parsedContent.rows.map((row) => {
      const fullName =
        readRowValue(row, ['full_name', 'fullname', 'name', 'candidate_name']) ??
        undefined;
      const emailValues = splitValues(
        readRowValue(row, ['email', 'emails', 'email_address']),
      );
      const phoneValues = splitValues(
        readRowValue(row, ['phone', 'phone_number', 'mobile', 'contact_number']),
      );
      const skillValues = splitValues(
        readRowValue(row, ['skills', 'skill', 'technologies']),
      );
      const city = readRowValue(row, ['city', 'location_city']);
      const region = readRowValue(row, ['region', 'state', 'location_region']);
      const country = readRowValue(row, ['country', 'location_country']);
      const linkedin = readRowValue(row, ['linkedin', 'linkedin_url']);
      const github = readRowValue(row, ['github', 'github_url']);
      const portfolio = readRowValue(row, ['portfolio', 'website', 'personal_site']);
      const company = readRowValue(row, ['current_company', 'company', 'employer']);
      const title = readRowValue(row, ['headline', 'title', 'current_title']);
      const school = readRowValue(row, ['school', 'institution', 'university', 'college']);

      return createPartialCandidate({
        fullName,
        headline: title,
        summary: readRowValue(row, ['summary', 'profile_summary', 'notes']),
        location:
          city || region || country
            ? createLocation({
                city,
                region,
                country,
                formatted: [city, region, country].filter(Boolean).join(', '),
              })
            : undefined,
        contactInfo: [
          ...emailValues.map((value, index) =>
            createContactInfo({
              kind: 'email',
              value,
              isPrimary: index === 0,
            }),
          ),
          ...phoneValues.map((value, index) =>
            createContactInfo({
              kind: 'phone',
              value,
              isPrimary: emailValues.length === 0 && index === 0,
            }),
          ),
        ],
        socialLinks: [
          ...(linkedin ? [createSocialLink({ platform: 'linkedin', url: linkedin })] : []),
          ...(github ? [createSocialLink({ platform: 'github', url: github })] : []),
          ...(portfolio ? [createSocialLink({ platform: 'portfolio', url: portfolio })] : []),
        ],
        experiences: company
          ? [
              createExperience({
                employer: company,
                title,
                startDate: readRowValue(row, ['start', 'start_date', 'current_start']),
                endDate: readRowValue(row, ['end', 'end_date', 'current_end']),
                isCurrent: !readRowValue(row, ['end', 'end_date', 'current_end']),
              }),
            ]
          : [],
        education: school
          ? [
              createEducation({
                institution: school,
                degree: readRowValue(row, ['degree']),
                fieldOfStudy: readRowValue(row, ['field', 'major', 'field_of_study']),
                endDate: readRowValue(row, ['grad_year', 'graduation_year', 'end_year']),
              }),
            ]
          : [],
        skills: skillValues.map((name) => createSkill({ name })),
        additionalData: Object.freeze({ rawRow: row }),
      });
    });
  }
}
