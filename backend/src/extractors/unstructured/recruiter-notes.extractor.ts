import { createContactInfo } from '../../models/contact-info';
import { createEducation } from '../../models/education';
import { createExperience } from '../../models/experience';
import { createLocation } from '../../models/location';
import { createPartialCandidate } from '../../models/partial-candidate';
import { createSkill } from '../../models/skill';
import { createSocialLink } from '../../models/social-link';
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
    const location = readLabeledValue(text, 'location') ?? readLabeledValue(text, 'address');
    const linkedin = readLabeledValue(text, 'linkedin');
    const github = readLabeledValue(text, 'github');
    const portfolio = readLabeledValue(text, 'portfolio') ?? readLabeledValue(text, 'website');
    const company = readLabeledValue(text, 'company') ?? readLabeledValue(text, 'current company');
    const title = readLabeledValue(text, 'title') ?? readLabeledValue(text, 'current title');
    const school = readLabeledValue(text, 'school') ?? readLabeledValue(text, 'education');
    const summary =
      readLabeledValue(text, 'summary') ?? readLabeledValue(text, 'notes');
    const skills = (readLabeledValue(text, 'skills') ?? '')
      .split(/[;,|]/)
      .map((item) => item.trim())
      .filter(Boolean);

    return [
      createPartialCandidate({
        fullName: name,
        headline: title,
        summary,
        location: location
          ? createLocation({
              raw: location,
              formatted: location,
              ...(() => {
                const [city, region, country] = location
                  .split(',')
                  .map((part) => part.trim())
                  .filter(Boolean);
                return { city, region, country };
              })(),
            })
          : undefined,
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
                isCurrent: true,
              }),
            ]
          : [],
        education: school
          ? [
              createEducation({
                institution: school,
              }),
            ]
          : [],
        skills: skills.map((skill) => createSkill({ name: skill })),
      }),
    ];
  }
}
