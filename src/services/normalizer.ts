/**
 * Advanced Arabic & Pharmaceutical Text Normalization Engine
 */

export interface NormalizedFormInfo {
  standardForm: string; // e.g. "TABLET", "CAPSULE", "SYRUP"
  arabicLabel: string; // e.g. "أقراص", "كبسولات"
  englishLabel: string; // e.g. "Tablet", "Capsule"
}

// Map of eastern Arabic numerals to western ASCII digits
const ARABIC_INDIC_DIGITS: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

/**
 * Converts any Eastern Arabic digits (٠-٩) to standard western digits (0-9)
 */
export function convertArabicDigits(input: string): string {
  if (!input) return '';
  return input.replace(/[٠-٩]/g, d => ARABIC_INDIC_DIGITS[d] || d);
}

/**
 * Fixes common Arabic OCR typos and character confusions in invoices
 * e.g. "18ما مل" -> "18 مل"
 */
export function fixOcrArtifacts(input: string): string {
  if (!input) return '';
  let str = input;

  // Pattern: Number followed by corrupted Arabic syllables like "ما", "يا", "با" before unit "مل" or "مجم"
  // Example from user: "18ما مل" -> "18 مل"
  str = str.replace(/(\d+)\s*(?:ما|يا|با|la)\s*(مل|مجم|ملجم|ملغ|ملم|ml)/gi, '$1 $2');

  // Common OCR confusion: "١٠*١٠" or "10 * 10" or "10x10"
  str = str.replace(/(\d+)\s*[\*xX×]\s*(\d+)/g, '$1x$2');

  return str;
}

/**
 * Standardize Arabic characters (Hamzas, Yaa, Taa Marbuta)
 */
export function normalizeArabicLetters(input: string): string {
  if (!input) return '';
  let str = input;

  // 1. Remove Tashkeel (harakat)
  str = str.replace(/[\u064B-\u065F\u0670]/g, '');

  // 2. Remove Tatweel / Kashida
  str = str.replace(/\u0640/g, '');

  // 3. Normalize all Hamza forms (أ, إ, آ, ٱ -> ا)
  str = str.replace(/[أإآٱ]/g, 'ا');

  // 4. Normalize Yaa / Alef Maksura (ى -> ي)
  str = str.replace(/ى/g, 'ي');

  // 5. Normalize Taa Marbuta to Haa at end of words for fuzzy phonetic matching (ة -> ه)
  // e.g. الرافة -> الرافه, الفتحة -> الفتحه, علبة -> علبه
  str = str.replace(/ة\b/g, 'ه');

  return str;
}

/**
 * Separate glued numbers and units/words:
 * e.g. "100ملجم" -> "100 ملجم"
 * e.g. "جليفيكس15مجم" -> "جليفيكس 15 مجم"
 * e.g. "100اقراص" -> "100 اقراص"
 */
export function separateGluedTokens(input: string): string {
  if (!input) return '';
  let str = input;

  // Insert space between Arabic/English letters and numbers
  str = str.replace(/([^\d\s\.\/])(\d+)/g, '$1 $2');
  str = str.replace(/(\d+)([^\d\s\.\/xX\*])/g, '$1 $2');

  // Replace slashes or dashes surrounded by letters with spaces: "شراب/الرافه" -> "شراب الرافه"
  str = str.replace(/[\/\\]+/g, ' ');
  str = str.replace(/[\-_]+/g, ' ');

  // Clean remaining unwanted punctuation but keep essential characters
  str = str.replace(/[^\u0621-\u064Aa-zA-Z0-9\.\+\%\*xX]/g, ' ');

  // Collapse multiple spaces
  str = str.replace(/\s+/g, ' ').trim();

  return str;
}

/**
 * Master Text Normalization pipeline
 */
export function normalizeText(input: string): string {
  if (!input) return '';

  let str = input.trim();
  str = convertArabicDigits(str);
  str = fixOcrArtifacts(str);
  str = normalizeArabicLetters(str);
  str = str.toLowerCase();
  str = separateGluedTokens(str);

  return str;
}

/**
 * Cleans compound words where spaces may or may not be present:
 * e.g. "دكلو دنك" vs "ديكلودنك", "تيبو دنت" vs "تيبودنت", "فورا كورت" vs "فوراكورت"
 */
export function getConsolidatedWord(input: string): string {
  return normalizeText(input).replace(/\s+/g, '');
}

/**
 * Levenshtein Distance
 */
export function levenshteinDistance(s1: string, s2: string): number {
  if (s1 === s2) return 0;
  if (!s1) return s2.length;
  if (!s2) return s1.length;

  const v0 = new Array(s2.length + 1);
  const v1 = new Array(s2.length + 1);

  for (let i = 0; i <= s2.length; i++) v0[i] = i;

  for (let i = 0; i < s1.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < s2.length; j++) {
      const cost = s1[i] === s2[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= s2.length; j++) v0[j] = v1[j];
  }

  return v1[s2.length];
}

/**
 * Normalized string similarity score (0 to 1)
 */
export function stringSimilarity(a: string, b: string): number {
  if (!a && !b) return 1.0;
  if (!a || !b) return 0.0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  return Math.max(0, 1 - levenshteinDistance(a, b) / maxLen);
}

/**
 * Jaro-Winkler Distance (high precision for trade names and typos)
 */
export function jaroWinklerSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0.0;

  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j]) continue;
      if (s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro =
    (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

  // Winkler prefix scale
  let prefix = 0;
  for (let i = 0; i < Math.min(4, len1, len2); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Token-based similarity: order-independent overlap
 */
export function tokenSimilarity(a: string, b: string): number {
  const normA = normalizeText(a);
  const normB = normalizeText(b);

  const tokensA = normA.split(' ').filter(t => t.length > 0);
  const tokensB = normB.split(' ').filter(t => t.length > 0);

  if (tokensA.length === 0 && tokensB.length === 0) return 1.0;
  if (tokensA.length === 0 || tokensB.length === 0) return 0.0;

  const setB = new Set(tokensB);
  let matchedTokens = 0;

  for (const tA of tokensA) {
    if (setB.has(tA)) {
      matchedTokens++;
    } else {
      // Check 1-char edit for words > 3 chars
      for (const tB of tokensB) {
        if (tA.length > 3 && tB.length > 3 && levenshteinDistance(tA, tB) <= 1) {
          matchedTokens += 0.85;
          break;
        }
      }
    }
  }

  const totalTokens = Math.max(tokensA.length, tokensB.length);
  return Math.min(1.0, matchedTokens / totalTokens);
}

export function cleanOcrArtifacts(input: string): string {
  return fixOcrArtifacts(input);
}

export function normalizeNumbers(input: string): string {
  return convertArabicDigits(input);
}

export function normalizeUnit(rawUnit: string): string {
  const norm = normalizeText(rawUnit).toLowerCase();
  const unitMap: Record<string, string> = {
    'ملجم': 'MG', 'مجم': 'MG', 'ملغ': 'MG', 'ملغم': 'MG', 'ملغرام': 'MG', 'مليغرام': 'MG', 'مليجرام': 'MG', 'mg': 'MG',
    'مكجم': 'MCG', 'ميكروجرام': 'MCG', 'ميكرو': 'MCG', 'mcg': 'MCG', 'ug': 'MCG',
    'جم': 'G', 'جرام': 'G', 'غرام': 'G', 'غم': 'G', 'g': 'G', 'gm': 'G',
    'مل': 'ML', 'ملل': 'ML', 'ml': 'ML',
    'وحدة': 'IU', 'وحدة دولية': 'IU', 'iu': 'IU',
    '%': '%',
  };
  return unitMap[norm] || rawUnit.toUpperCase();
}

export function findDosageForm(input: string): NormalizedFormInfo | undefined {
  const norm = normalizeText(input);
  const forms: Array<{ regex: RegExp; info: NormalizedFormInfo }> = [
    { regex: /\b(اقراص|أقراص|اقرص|قرص|tab|tabs|tablet|tablets|fct)\b/i, info: { standardForm: 'TABLET', arabicLabel: 'أقراص', englishLabel: 'Tablet' } },
    { regex: /\b(كبسول|كبسوله|كبسولة|كبسولات|cap|caps|capsule|capsules)\b/i, info: { standardForm: 'CAPSULE', arabicLabel: 'كبسولات', englishLabel: 'Capsule' } },
    { regex: /\b(امبول|أمبول|امبولة|أمبولة|امبولات|أمبولات|amp|amps|ampoule)\b/i, info: { standardForm: 'AMPOULE', arabicLabel: 'أمبولات', englishLabel: 'Ampoule' } },
    { regex: /\b(فيال|فياله|فيالة|فيالات|vial|vials)\b/i, info: { standardForm: 'VIAL', arabicLabel: 'فيال', englishLabel: 'Vial' } },
    { regex: /\b(شراب|معلق|syr|syrup|susp|suspension)\b/i, info: { standardForm: 'SYRUP', arabicLabel: 'شراب', englishLabel: 'Syrup' } },
    { regex: /\b(قطرة|قطره|قطرات|نقط|drop|drops)\b/i, info: { standardForm: 'DROP', arabicLabel: 'قطرة', englishLabel: 'Drops' } },
    { regex: /\b(كريم|cream|crm)\b/i, info: { standardForm: 'CREAM', arabicLabel: 'كريم', englishLabel: 'Cream' } },
    { regex: /\b(مرهم|ointment|oint)\b/i, info: { standardForm: 'OINTMENT', arabicLabel: 'مرهم', englishLabel: 'Ointment' } },
    { regex: /\b(جل|gel)\b/i, info: { standardForm: 'GEL', arabicLabel: 'جل', englishLabel: 'Gel' } },
    { regex: /\b(بخاخ|استنشاق|spray|inhaler)\b/i, info: { standardForm: 'SPRAY', arabicLabel: 'بخاخ', englishLabel: 'Spray' } },
    { regex: /\b(تحاميل|تحميلة|لبوس|supp|suppository)\b/i, info: { standardForm: 'SUPPOSITORY', arabicLabel: 'تحاميل', englishLabel: 'Suppository' } },
    { regex: /\b(أكياس|اكياس|كيس|فوار|sachet|sachets)\b/i, info: { standardForm: 'SACHET', arabicLabel: 'أكياس', englishLabel: 'Sachet' } },
  ];

  for (const f of forms) {
    if (f.regex.test(norm)) {
      return f.info;
    }
  }
  return undefined;
}

export { normalizeArabicMedicalText, tokenSortRatio } from './medicalInvoiceMatcher';

/**
 * Extract numbers including decimals and localized digits
 */
export function extractNumbers(text: string): number[] {
  if (!text) return [];
  const t = String(text).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
  const m = t.match(/\d+\.?\d*/g) || [];
  const arr: number[] = [];
  for (let i = 0; i < m.length; i++) {
    const n = parseFloat(m[i]);
    if (!isNaN(n) && !arr.includes(n)) arr.push(n);
    if (m[i].includes('.')) {
      const p = m[i].split('.');
      for (let k = 0; k < p.length; k++) {
        const v = parseFloat(p[k]);
        if (!isNaN(v) && !arr.includes(v)) arr.push(v);
      }
    }
  }
  return arr.sort((a, b) => a - b);
}

/**
 * دالة قياس تشابه الأرقام والجرعات مع عقوبات وحوافز دقيقة (dsim)
 * - الحالتين بدون أرقام: محايد (0.75)
 * - واحدة فيها أرقام والأخرى لا: عقوبة قوية (0.1)
 * - تطابق كامل: 1.0
 * - حساب Jaccard مع F1 (Recall + Precision) وعقوبة في حال انعدام التطابق (0.35)
 */
export function dsim(a: string, b: string): number {
  const na = extractNumbers(a);
  const nb = extractNumbers(b);

  // الحالتين فاضيتين - محايد
  if (!na.length && !nb.length) return 0.75;

  // واحدة فيها أرقام والتانية لأ - عقوبة قوية
  if (!na.length || !nb.length) return 0.1;

  // عدّ التطابقات الدقيقة
  const matchedA: Record<number, boolean> = {};
  const matchedB: Record<number, boolean> = {};
  let matchCount = 0;

  for (let i = 0; i < na.length; i++) {
    for (let j = 0; j < nb.length; j++) {
      if (na[i] === nb[j] && !matchedA[i] && !matchedB[j]) {
        matchCount++;
        matchedA[i] = true;
        matchedB[j] = true;
        break;
      }
    }
  }

  // تطابق كامل - أعلى درجة
  if (matchCount === na.length && matchCount === nb.length) return 1.0;

  // تطابق جزيئي - احسب Jaccard
  const union: Record<number, boolean> = {};
  for (let k = 0; k < na.length; k++) union[na[k]] = true;
  for (let m = 0; m < nb.length; m++) union[nb[m]] = true;
  const jaccard = matchCount / Object.keys(union).length;

  // Recall + Precision (F1)
  const recall = matchCount / na.length;
  const precision = matchCount / nb.length;
  const f1 = (recall + precision) > 0 ? (2 * recall * precision) / (recall + precision) : 0;

  // اجمع: خد الأقوى + مكافأة للتطابق الجزئي القوي
  let combined = Math.max(jaccard, f1 * 0.95);

  // لو مفيش أي تطابق - عقوبة شديدة
  if (matchCount === 0) combined *= 0.35;

  return combined;
}

/**
 * Phonetic Arabic transliteration dictionary for sounding-alike letters:
 * ص -> س, ض -> د, ط -> ت, ظ -> ز, ذ -> ز, ث -> س, ق -> ك, ء -> ا
 */
export const PHONETIC_MAP: Record<string, string> = {
  'ص': 'س',
  'ض': 'د',
  'ط': 'ت',
  'ظ': 'ز',
  'ذ': 'ز',
  'ث': 'س',
  'ق': 'ك',
  'ء': 'ا',
};

export function phoneticArabic(text: string): string {
  if (!text) return '';
  let r = '';
  for (let i = 0; i < text.length; i++) {
    r += PHONETIC_MAP[text[i]] || text[i];
  }
  return r;
}

