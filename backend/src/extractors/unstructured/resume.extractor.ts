import { createContactInfo } from '../../models/contact-info';
import { createPartialCandidate } from '../../models/partial-candidate';
import { createSkill } from '../../models/skill';
import { createSocialLink } from '../../models/social-link';
import type { PartialCandidate } from '../../models/partial-candidate';
import type { Extractor } from '../base/extractor.interface';
import type { IngestionSource, ParsedContent, ParsedTextContent } from '../base/extractor.types';

function getSection(text: string, heading: string): string | undefined {
  const pattern = new RegExp(
    `${heading}\\s*[:\\n\\r]+([\\s\\S]*?)(?:\\n[A-Z][A-Z\\s]{2,}|$)`,
    'i',
  );
  return text.match(pattern)?.[1]?.trim();
}

function splitSkills(section: string | undefined): string[] {
  if (!section) {
    return [];
  }

  return section
    .split(/[,\n|;]/)
    .map((item) => item.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);
}

export class ResumeExtractor implements Extractor<ParsedTextContent> {
  public readonly name = 'ResumeExtractor';

  supports(source: IngestionSource, parsedContent: ParsedContent): boolean {
    return (
      parsedContent.kind === 'text' &&
      (source.sourceType === 'resume' || source.fileName.toLowerCase().includes('resume'))
    );
  }

  async extract(parsedContent: ParsedTextContent): Promise<readonly PartialCandidate[]> {
    const text = parsedContent.text;
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const fullName = lines[0] && lines[0].length <= 80 ? lines[0] : undefined;
    const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
    const phone = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0]?.trim();
    const linkedin = text.match(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s]+/i)?.[0];
    const github = text.match(/https?:\/\/(?:www\.)?github\.com\/[^\s]+/i)?.[0];
    const summary =
      getSection(text, 'summary') ??
      getSection(text, 'profile') ??
      getSection(text, 'professional summary');
    const skills = splitSkills(
      getSection(text, 'skills') ?? getSection(text, 'technical skills'),
    );

    return [
      createPartialCandidate({
        fullName,
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
        socialLinks: [
          ...(linkedin
            ? [
                createSocialLink({
                  platform: 'linkedin',
                  url: linkedin,
                }),
              ]
            : []),
          ...(github
            ? [
                createSocialLink({
                  platform: 'github',
                  url: github,
                }),
              ]
            : []),
        ],
        skills: skills.map((name) => createSkill({ name })),
      }),
    ];
  }
}
