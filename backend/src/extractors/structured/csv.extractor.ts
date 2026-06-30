import { createContactInfo } from '../../models/contact-info';
import { createPartialCandidate } from '../../models/partial-candidate';
import { createSkill } from '../../models/skill';
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

      return createPartialCandidate({
        fullName,
        headline: readRowValue(row, ['headline', 'title', 'current_title']),
        summary: readRowValue(row, ['summary', 'profile_summary', 'notes']),
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
        skills: skillValues.map((name) => createSkill({ name })),
        additionalData: Object.freeze({ rawRow: row }),
      });
    });
  }
}
