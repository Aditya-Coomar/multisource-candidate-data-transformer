import { createContactInfo } from '../../models/contact-info';
import { createPartialCandidate } from '../../models/partial-candidate';
import { createSkill } from '../../models/skill';
import type { PartialCandidate } from '../../models/partial-candidate';
import type { Extractor } from '../base/extractor.interface';
import type { IngestionSource, ParsedContent, ParsedTextContent } from '../base/extractor.types';

function readLabeledValue(text: string, label: string): string | undefined {
  return text.match(new RegExp(`${label}\\s*:\\s*(.+)`, 'i'))?.[1]?.trim();
}

export class RecruiterNotesExtractor implements Extractor<ParsedTextContent> {
  public readonly name = 'RecruiterNotesExtractor';

  supports(source: IngestionSource, parsedContent: ParsedContent): boolean {
    return (
      parsedContent.kind === 'text' &&
      (source.sourceType === 'manual' ||
        source.fileName.toLowerCase().includes('notes') ||
        source.fileName.toLowerCase().includes('recruiter'))
    );
  }

  async extract(parsedContent: ParsedTextContent): Promise<readonly PartialCandidate[]> {
    const text = parsedContent.text;
    const name = readLabeledValue(text, 'name');
    const email = readLabeledValue(text, 'email');
    const phone = readLabeledValue(text, 'phone');
    const summary =
      readLabeledValue(text, 'summary') ?? readLabeledValue(text, 'notes');
    const skills = (readLabeledValue(text, 'skills') ?? '')
      .split(/[;,|]/)
      .map((item) => item.trim())
      .filter(Boolean);

    return [
      createPartialCandidate({
        fullName: name,
        summary,
        contactInfo: [
          ...(email
            ? [
                createContactInfo({
                  kind: 'email',
                  value: email,
                  isPrimary: true,
                }),
              ]
            : []),
          ...(phone
            ? [
                createContactInfo({
                  kind: 'phone',
                  value: phone,
                  isPrimary: !email,
                }),
              ]
            : []),
        ],
        skills: skills.map((skill) => createSkill({ name: skill })),
      }),
    ];
  }
}
