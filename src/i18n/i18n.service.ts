import { Injectable } from '@nestjs/common';
import { Language } from '@prisma/client';
import { uz } from './locales/uz';
import { ru } from './locales/ru';
import { RegionKey, Translations } from './types/translations.interface';

const TRANSLATIONS: Record<Language, Translations> = { uz, ru };

@Injectable()
export class I18nService {
  t(lang: Language | null | undefined): Translations {
    return TRANSLATIONS[lang ?? Language.uz] ?? TRANSLATIONS[Language.uz];
  }

  /** Returns one string per registered language (duplicates removed). */
  allVariants(selector: (t: Translations) => string): string[] {
    return [...new Set(Object.values(TRANSLATIONS).map(selector))];
  }

  /**
   * Maps any-language region display name back to the Uzbek canonical name
   * used for DB storage. Returns null when the input matches no known region.
   */
  resolveRegion(input: string): string | null {
    for (const translations of Object.values(TRANSLATIONS)) {
      for (const [key, name] of Object.entries(
        translations.registration.regions,
      )) {
        if (name === input) {
          return TRANSLATIONS[Language.uz].registration.regions[
            key as RegionKey
          ];
        }
      }
    }
    return null;
  }
}
