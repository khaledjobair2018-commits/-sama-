import { DictionaryEntry, DictionaryType } from '../types/pharmacy';
import { normalizeText } from './normalizer';

const DICTIONARY_STORAGE_KEY = 'pharma_custom_dictionaries_v2';

// 1. BUILT-IN UNIT MAPPINGS
export const BUILT_IN_UNIT_MAP: Record<string, string> = {
  // Milligram variants
  'mg': 'MG',
  'ملغ': 'MG',
  'ملغم': 'MG',
  'ملجم': 'MG',
  'مجم': 'MG',
  'مغ': 'MG',
  'مليغرام': 'MG',
  'مليجرام': 'MG',
  'ميج': 'MG',
  'milligram': 'MG',

  // Microgram variants
  'mcg': 'MCG',
  'ug': 'MCG',
  'µg': 'MCG',
  'مكجم': 'MCG',
  'ميكروجرام': 'MCG',
  'ميكروغرام': 'MCG',
  'ميكرو': 'MCG',
  'microgram': 'MCG',

  // Gram variants
  'g': 'G',
  'gm': 'G',
  'جرام': 'G',
  'غرام': 'G',
  'جم': 'G',
  'غم': 'G',
  'غ': 'G',
  'gram': 'G',

  // International Unit variants
  'iu': 'IU',
  'u': 'IU',
  'وحدة': 'IU',
  'وحده': 'IU',
  'وحدة دولية': 'IU',
  'وحده دوليه': 'IU',
  'international unit': 'IU',

  // Milliliter variants
  'ml': 'ML',
  'مل': 'ML',
  'ملل': 'ML',
  'ملم': 'ML',
  'milliliter': 'ML',

  // Percentage variants
  '%': '%',
  'بالمئة': '%',
  'في المئة': '%',
  'بالمائة': '%',
  'percent': '%',
};

// 2. BUILT-IN DOSAGE FORM MAPPINGS
export const BUILT_IN_FORM_MAP: Record<string, { standardForm: string; arabicLabel: string; englishLabel: string }> = {
  // Tablets
  'tab': { standardForm: 'TABLET', arabicLabel: 'أقراص', englishLabel: 'Tablet' },
  'tabs': { standardForm: 'TABLET', arabicLabel: 'أقراص', englishLabel: 'Tablets' },
  'tablet': { standardForm: 'TABLET', arabicLabel: 'أقراص', englishLabel: 'Tablet' },
  'tablets': { standardForm: 'TABLET', arabicLabel: 'أقراص', englishLabel: 'Tablets' },
  'قرص': { standardForm: 'TABLET', arabicLabel: 'أقراص', englishLabel: 'Tablet' },
  'اقراص': { standardForm: 'TABLET', arabicLabel: 'أقراص', englishLabel: 'Tablets' },
  'أقراص': { standardForm: 'TABLET', arabicLabel: 'أقراص', englishLabel: 'Tablets' },
  'اقرص': { standardForm: 'TABLET', arabicLabel: 'أقراص', englishLabel: 'Tablets' },
  'حبه': { standardForm: 'TABLET', arabicLabel: 'أقراص', englishLabel: 'Tablet' },
  'حبة': { standardForm: 'TABLET', arabicLabel: 'أقراص', englishLabel: 'Tablet' },
  'حبوب': { standardForm: 'TABLET', arabicLabel: 'أقراص', englishLabel: 'Tablets' },
  'fct': { standardForm: 'TABLET', arabicLabel: 'أقراص مغلفة', englishLabel: 'FCT' },
  'ct': { standardForm: 'TABLET', arabicLabel: 'أقراص', englishLabel: 'Coated Tablet' },

  // Capsules
  'cap': { standardForm: 'CAPSULE', arabicLabel: 'كبسولات', englishLabel: 'Capsule' },
  'caps': { standardForm: 'CAPSULE', arabicLabel: 'كبسولات', englishLabel: 'Capsules' },
  'capsule': { standardForm: 'CAPSULE', arabicLabel: 'كبسولات', englishLabel: 'Capsule' },
  'capsules': { standardForm: 'CAPSULE', arabicLabel: 'كبسولات', englishLabel: 'Capsules' },
  'كبسول': { standardForm: 'CAPSULE', arabicLabel: 'كبسولات', englishLabel: 'Capsule' },
  'كبسوله': { standardForm: 'CAPSULE', arabicLabel: 'كبسولات', englishLabel: 'Capsule' },
  'كبسولة': { standardForm: 'CAPSULE', arabicLabel: 'كبسولات', englishLabel: 'Capsule' },
  'كبسولات': { standardForm: 'CAPSULE', arabicLabel: 'كبسولات', englishLabel: 'Capsules' },

  // Ampoules
  'amp': { standardForm: 'AMPOULE', arabicLabel: 'أمبولات', englishLabel: 'Ampoule' },
  'amps': { standardForm: 'AMPOULE', arabicLabel: 'أمبولات', englishLabel: 'Ampoules' },
  'ampoule': { standardForm: 'AMPOULE', arabicLabel: 'أمبولات', englishLabel: 'Ampoule' },
  'امبول': { standardForm: 'AMPOULE', arabicLabel: 'أمبولات', englishLabel: 'Ampoule' },
  'أمبول': { standardForm: 'AMPOULE', arabicLabel: 'أمبولات', englishLabel: 'Ampoule' },
  'امبولة': { standardForm: 'AMPOULE', arabicLabel: 'أمبولات', englishLabel: 'Ampoule' },
  'امبوله': { standardForm: 'AMPOULE', arabicLabel: 'أمبولات', englishLabel: 'Ampoule' },
  'أمبولة': { standardForm: 'AMPOULE', arabicLabel: 'أمبولات', englishLabel: 'Ampoule' },
  'امبولات': { standardForm: 'AMPOULE', arabicLabel: 'أمبولات', englishLabel: 'Ampoules' },

  // Vials
  'vial': { standardForm: 'VIAL', arabicLabel: 'فيال', englishLabel: 'Vial' },
  'vials': { standardForm: 'VIAL', arabicLabel: 'فيالات', englishLabel: 'Vials' },
  'فيال': { standardForm: 'VIAL', arabicLabel: 'فيال', englishLabel: 'Vial' },
  'فياله': { standardForm: 'VIAL', arabicLabel: 'فيالة', englishLabel: 'Vial' },
  'فيالة': { standardForm: 'VIAL', arabicLabel: 'فيالة', englishLabel: 'Vial' },
  'فيالات': { standardForm: 'VIAL', arabicLabel: 'فيالات', englishLabel: 'Vials' },

  // Syrup / Suspension
  'syr': { standardForm: 'SYRUP', arabicLabel: 'شراب', englishLabel: 'Syrup' },
  'syrup': { standardForm: 'SYRUP', arabicLabel: 'شراب', englishLabel: 'Syrup' },
  'susp': { standardForm: 'SYRUP', arabicLabel: 'معلق', englishLabel: 'Suspension' },
  'suspension': { standardForm: 'SYRUP', arabicLabel: 'معلق', englishLabel: 'Suspension' },
  'شراب': { standardForm: 'SYRUP', arabicLabel: 'شراب', englishLabel: 'Syrup' },
  'معلق': { standardForm: 'SYRUP', arabicLabel: 'معلق', englishLabel: 'Suspension' },
  'إكسير': { standardForm: 'SYRUP', arabicLabel: 'إكسير', englishLabel: 'Elixir' },

  // Drops
  'drop': { standardForm: 'DROP', arabicLabel: 'قطرة', englishLabel: 'Drops' },
  'drops': { standardForm: 'DROP', arabicLabel: 'قطرات', englishLabel: 'Drops' },
  'قطرة': { standardForm: 'DROP', arabicLabel: 'قطرة', englishLabel: 'Drops' },
  'قطره': { standardForm: 'DROP', arabicLabel: 'قطرة', englishLabel: 'Drops' },
  'قطرات': { standardForm: 'DROP', arabicLabel: 'قطرات', englishLabel: 'Drops' },
  'قطر': { standardForm: 'DROP', arabicLabel: 'قطرة', englishLabel: 'Drops' },
  'نقط': { standardForm: 'DROP', arabicLabel: 'نقط', englishLabel: 'Drops' },

  // Gel
  'gel': { standardForm: 'GEL', arabicLabel: 'جل', englishLabel: 'Gel' },
  'جل': { standardForm: 'GEL', arabicLabel: 'جل', englishLabel: 'Gel' },

  // Cream & Ointment
  'cream': { standardForm: 'CREAM', arabicLabel: 'كريم', englishLabel: 'Cream' },
  'crm': { standardForm: 'CREAM', arabicLabel: 'كريم', englishLabel: 'Cream' },
  'كريم': { standardForm: 'CREAM', arabicLabel: 'كريم', englishLabel: 'Cream' },
  'ointment': { standardForm: 'OINTMENT', arabicLabel: 'مرهم', englishLabel: 'Ointment' },
  'oint': { standardForm: 'OINTMENT', arabicLabel: 'مرهم', englishLabel: 'Ointment' },
  'مرهم': { standardForm: 'OINTMENT', arabicLabel: 'مرهم', englishLabel: 'Ointment' },

  // Rotacaps / Inhaler
  'rotacap': { standardForm: 'ROTACAP', arabicLabel: 'روتاكاب استنشاق', englishLabel: 'Rotacap' },
  'rotacaps': { standardForm: 'ROTACAP', arabicLabel: 'روتاكاب استنشاق', englishLabel: 'Rotacaps' },
  'روتاكاب': { standardForm: 'ROTACAP', arabicLabel: 'روتاكاب استنشاق', englishLabel: 'Rotacap' },
  'روتاكابس': { standardForm: 'ROTACAP', arabicLabel: 'روتاكاب استنشاق', englishLabel: 'Rotacaps' },
  'spray': { standardForm: 'SPRAY', arabicLabel: 'بخاخ', englishLabel: 'Spray' },
  'بخاخ': { standardForm: 'SPRAY', arabicLabel: 'بخاخ', englishLabel: 'Spray' },
  'استنشاق': { standardForm: 'SPRAY', arabicLabel: 'بخاخ استنشاق', englishLabel: 'Inhaler' },

  // Suppository
  'supp': { standardForm: 'SUPPOSITORY', arabicLabel: 'تحاميل', englishLabel: 'Suppository' },
  'suppository': { standardForm: 'SUPPOSITORY', arabicLabel: 'تحاميل', englishLabel: 'Suppository' },
  'تحاميل': { standardForm: 'SUPPOSITORY', arabicLabel: 'تحاميل', englishLabel: 'Suppository' },
  'تحميلة': { standardForm: 'SUPPOSITORY', arabicLabel: 'تحميلة', englishLabel: 'Suppository' },
  'لبوس': { standardForm: 'SUPPOSITORY', arabicLabel: 'لبوس', englishLabel: 'Suppository' },

  // Sachets / Effervescent
  'sachet': { standardForm: 'SACHET', arabicLabel: 'أكياس', englishLabel: 'Sachet' },
  'sachets': { standardForm: 'SACHET', arabicLabel: 'أكياس', englishLabel: 'Sachets' },
  'كيس': { standardForm: 'SACHET', arabicLabel: 'كيس', englishLabel: 'Sachet' },
  'أكياس': { standardForm: 'SACHET', arabicLabel: 'أكياس', englishLabel: 'Sachets' },
  'اكياس': { standardForm: 'SACHET', arabicLabel: 'أكياس', englishLabel: 'Sachets' },
  'فوار': { standardForm: 'SACHET', arabicLabel: 'فوار', englishLabel: 'Effervescent' },
};

// 3. BUILT-IN COMPANY / DISTRIBUTOR ALIASES
export const BUILT_IN_COMPANY_ALIASES: Record<string, string> = {
  'الفتحة': 'الفتح',
  'الفتحه': 'الفتح',
  'الفتح': 'الفتح',
  'الرافة': 'الرافه',
  'الرافه': 'الرافه',
  'الغزالي': 'الغزالي',
  'الجبل': 'الجبل',
  'المفضل': 'المفضل',
  'الميتمي': 'الميتمي',
  'الميتمى': 'الميتمي',
  'بلقيس': 'بلقيس',
  'الجنتين': 'الدوائية الأردنية',
  'الدوائية الأردنية': 'الدوائية الأردنية',
  'الدوائيه الاردنيه': 'الدوائية الأردنية',
  'سيبل': 'سيبلا',
  'سيبلا': 'سيبلا',
  'cipla': 'سيبلا',
  'gsk': 'gsk',
  'جلاكسو': 'gsk',
  'تبوك': 'تبوك',
  'tabuk': 'تبوك',
  'سبيماكو': 'سبيماكو',
  'spimaco': 'سبيماكو',
  'نوفارتس': 'نوفارتس',
  'novartis': 'نوفارتس',
  'فايزر': 'فايزر',
  'pfizer': 'فايزر',
  'ميرك': 'ميرك',
  'merck': 'ميرك',
  'ابوت': 'ابوت',
  'abbott': 'ابوت',
  'استرازينيكا': 'استرازينيكا',
  'astrazeneca': 'استرازينيكا',
};

// 4. BUILT-IN PRODUCT / TRADE NAME ALIASES
export const BUILT_IN_PRODUCT_ALIASES: Record<string, string> = {
  'دكلو دنك': 'ديكلودنك',
  'دكلودنك': 'ديكلودنك',
  'دكلو دانك': 'ديكلودنك',
  'دوفلك': 'دوفلاك',
  'دوفلاك': 'دوفلاك',
  'تيبو دنت': 'تيبودنت',
  'تيبودنت': 'تيبودنت',
  'لينوبريل': 'لينوبريل',
  'ليسينوبريل': 'لينوبريل',
  'سوبرانيل': 'سوبرانيل',
  'فوراكورت': 'فوراكورت',
  'نيستاتين': 'نيستاتين',
  'جليفيكس': 'جليفيكس',
  'جلايفكس': 'جليفيكس',
  'بنادول': 'بانادول',
  'بانادول': 'بانادول',
  'باراسيتامول': 'بانادول',
  'اوجمنتين': 'أوجمنتين',
  'أوجمنتين': 'أوجمنتين',
  'انبولين': 'انسولين',
  'انسولين': 'انسولين',
  'انبول': 'امبول',
};

// 5. GENERIC STOP WORDS (do not determine drug core identity)
export const STOP_WORDS = new Set([
  'علبة', 'علبه', 'عبوة', 'عبوه', 'شريط', 'شريطه', 'شرايط',
  'كرتون', 'باكيت', 'للفم', 'عن', 'طريق', 'موضعي', 'box', 'pack',
  'strips', 'strip', 'oral', 'topical', 'external', 'use',
  'مجموعة', 'مجموعه', 'مج', 'فيال', 'امبولات', 'اقراص', 'قرص',
  'كبسولات', 'كبسوله', 'شراب', 'كريم', 'جل', 'مرهم', 'بخاخ',
  'قطرة', 'محلول', 'معلق', 'رسمي', 'وكيل', 'معتمد', 'توريد',
  'مورد', 'انتاج', 'صناعه', 'فارما', 'فارم', 'فارماسي', 'الدوائيه',
  'الدوائية', 'لصناعات', 'الصناعات', 'شركة', 'مؤسسه', 'مؤسسة',
  'مستودع', 'مخازن', 'مخزن'
]);

class DictionaryService {
  private customEntries: DictionaryEntry[] = [];

  constructor() {
    this.loadCustomEntries();
  }

  private loadCustomEntries() {
    try {
      const data = localStorage.getItem(DICTIONARY_STORAGE_KEY);
      this.customEntries = data ? JSON.parse(data) : [];
    } catch {
      this.customEntries = [];
    }
  }

  public getAllEntries(): DictionaryEntry[] {
    return this.customEntries;
  }

  public saveEntry(entry: Omit<DictionaryEntry, 'id' | 'createdAt'>): DictionaryEntry {
    const fromNorm = normalizeText(entry.fromTerm);
    const toNorm = normalizeText(entry.toTerm);

    const existingIdx = this.customEntries.findIndex(
      e => normalizeText(e.fromTerm) === fromNorm && e.type === entry.type
    );

    const newEntry: DictionaryEntry = {
      ...entry,
      id: `DICT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      fromTerm: fromNorm,
      toTerm: toNorm,
      createdAt: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      this.customEntries[existingIdx] = newEntry;
    } else {
      this.customEntries.unshift(newEntry);
    }

    localStorage.setItem(DICTIONARY_STORAGE_KEY, JSON.stringify(this.customEntries));
    return newEntry;
  }

  public deleteEntry(id: string): void {
    this.customEntries = this.customEntries.filter(e => e.id !== id);
    localStorage.setItem(DICTIONARY_STORAGE_KEY, JSON.stringify(this.customEntries));
  }

  /**
   * Resolves a unit term to canonical unit (e.g. "ملغرام" -> "MG")
   */
  public resolveUnit(rawUnit: string): string | undefined {
    const clean = normalizeText(rawUnit).toLowerCase();
    // Check custom
    const custom = this.customEntries.find(e => e.type === 'UNIT' && normalizeText(e.fromTerm) === clean);
    if (custom) return custom.toTerm.toUpperCase();
    // Check built-in
    return BUILT_IN_UNIT_MAP[clean];
  }

  /**
   * Resolves dosage form (e.g. "كبسول" -> TABLET/CAPSULE info)
   */
  public resolveForm(rawForm: string): { standardForm: string; arabicLabel: string; englishLabel: string } | undefined {
    const clean = normalizeText(rawForm).toLowerCase();
    // Check custom
    const custom = this.customEntries.find(e => e.type === 'FORM' && normalizeText(e.fromTerm) === clean);
    if (custom) {
      return { standardForm: custom.toTerm.toUpperCase(), arabicLabel: custom.toTerm, englishLabel: custom.toTerm };
    }
    // Check built-in
    return BUILT_IN_FORM_MAP[clean];
  }

  /**
   * Resolves company name (e.g. "الفتحة" -> "الفتح", "الرافة" -> "الرافه")
   */
  public resolveCompany(rawCompany: string): string {
    const clean = normalizeText(rawCompany);
    // Check custom
    const custom = this.customEntries.find(e => e.type === 'COMPANY' && normalizeText(e.fromTerm) === clean);
    if (custom) return custom.toTerm;
    // Check built-in
    return BUILT_IN_COMPANY_ALIASES[clean] || clean;
  }

  /**
   * Resolves core product alias (e.g. "دكلو دنك" -> "ديكلودنك", "دوفلك" -> "دوفلاك")
   */
  public resolveProductAlias(rawName: string): string {
    const clean = normalizeText(rawName);
    const custom = this.customEntries.find(e => e.type === 'PRODUCT' && normalizeText(e.fromTerm) === clean);
    if (custom) return custom.toTerm;
    return BUILT_IN_PRODUCT_ALIASES[clean] || clean;
  }
}

export const dictionaryService = new DictionaryService();

export function lookupUnit(rawUnit: string): string | undefined {
  return dictionaryService.resolveUnit(rawUnit);
}

export function lookupDosageForm(rawForm: string): { standardForm: string; arabicLabel: string; englishLabel: string } | undefined {
  return dictionaryService.resolveForm(rawForm);
}

export function lookupCompany(input: string): { canonical: string; rawMatched: string } | undefined {
  const norm = normalizeText(input);
  for (const [alias, canonical] of Object.entries(BUILT_IN_COMPANY_ALIASES)) {
    if (norm.includes(alias)) {
      return { canonical, rawMatched: alias };
    }
  }
  return undefined;
}

export function normalizeTradeNameCompound(text: string): string {
  let res = text;
  for (const [variant, canonical] of Object.entries(BUILT_IN_PRODUCT_ALIASES)) {
    if (res.includes(variant)) {
      res = res.replace(new RegExp(`\\b${variant}\\b`, 'g'), canonical);
    }
  }
  return res;
}

export function getAllTradeNameAliases(tradeName: string): string[] {
  const norm = normalizeText(tradeName);
  const aliases: string[] = [];
  for (const [variant, canonical] of Object.entries(BUILT_IN_PRODUCT_ALIASES)) {
    if (norm === variant || norm === canonical) {
      aliases.push(variant, canonical);
    }
  }
  return Array.from(new Set(aliases));
}
