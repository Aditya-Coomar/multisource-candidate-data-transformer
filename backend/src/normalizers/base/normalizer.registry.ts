import { UnsupportedNormalizationError } from '../../errors';
import { CompanyNormalizer } from '../company/company.normalizer';
import { DateNormalizer } from '../date/date.normalizer';
import { EducationNormalizer } from '../education/education.normalizer';
import { EmailNormalizer } from '../email/email.normalizer';
import { ExperienceNormalizer } from '../experience/experience.normalizer';
import { LocationNormalizer } from '../location/location.normalizer';
import { PhoneNormalizer } from '../phone/phone.normalizer';
import { SkillNormalizer } from '../skill/skill.normalizer';
import { UrlNormalizer } from '../url/url.normalizer';
import type { Normalizer } from './normalizer.interface';

export class NormalizerRegistry {
  private readonly normalizers: Normalizer<string>[] = [];

  constructor(normalizers?: readonly Normalizer<string>[]) {
    if (normalizers) {
      this.normalizers.push(...normalizers);
      return;
    }

    this.normalizers.push(
      new PhoneNormalizer(),
      new EmailNormalizer(),
      new DateNormalizer(),
      new SkillNormalizer(),
      new LocationNormalizer(),
      new CompanyNormalizer(),
      new UrlNormalizer(),
      new ExperienceNormalizer(),
      new EducationNormalizer(),
    );
  }

  register(normalizer: Normalizer<string>): void {
    this.normalizers.push(normalizer);
  }

  resolve(field: string): Normalizer<string> {
    const normalizer = this.normalizers.find((candidate) =>
      candidate.supports(field),
    );

    if (!normalizer) {
      throw new UnsupportedNormalizationError(
        'No normalizer registered for field.',
        {
          field,
          originalValue: undefined,
          normalizer: 'NormalizerRegistry',
        },
      );
    }

    return normalizer;
  }

  list(): readonly Normalizer<string>[] {
    return this.normalizers;
  }
}
