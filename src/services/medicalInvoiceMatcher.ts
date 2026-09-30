/**
 * MedicalInvoiceMatcher
 * TypeScript implementation matching 1:1 with Python MedicalInvoiceMatcher
 * High-performance Arabic Normalization, Token Sort Ratio, Price Tolerance & Quantity Fallback
 */

import { levenshteinDistance } from './normalizer';

export interface MedicalCatalogItem {
  id?: string;
  item_name: string;
  item_price: number;
  quantity?: number;
  barcode?: string;
  normalized_name?: string;
  rawMasterItem?: any;
}

export interface MedicalInvoiceItemInput {
  item_name: string;
  unit_price: number;
  quantity: number;
  barcode?: string;
}

export interface MedicalMatchScoreResult {
  invoice_name: string;
  system_name: string;
  name_similarity: number;
  price_match: boolean;
  price_score: number;
  price_diff: string;
  qty_match: boolean;
  qty_score: number;
  final_confidence: number;
  status: string;
  match_reason: string;
  is_price_fallback: boolean;
  system_item: MedicalCatalogItem;
}

/**
 * 1. دالة تنظيف وتوحيد النصوص العربية (تشمل توحيد أشكال الجرعات)
 */
export function normalizeArabicMedicalText(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let s = text.trim();

  // 1. إزالة التشكيل
  s = s.replace(/[\u064B-\u0652\u0670]/g, '');

  // 2. توحيد الهمزات (أ، إ، آ، ٱ -> ا)
  s = s.replace(/[أإآٱ]/g, 'ا');

  // 3. توحيد التاء المربوطة والهاء (ة -> ه)
  s = s.replace(/ة/g, 'ه');

  // 4. توحيد الألف المقصورة (ى -> ي)
  s = s.replace(/ى/g, 'ي');

  // 5. إزالة الرموز وعلامات الترقيم
  s = s.replace(/[^\w\s\u0600-\u06FF]/g, ' ');

  // 6. إزالة المسافات الزائدة
  s = s.replace(/\s+/g, ' ').trim().toLowerCase();

  // 7. توحيد أشكال الجرعات (Dosage Forms Unification)
  const dosageDict: Record<string, string> = {
    'اقراص': '[TABLET]', 'قرص': '[TABLET]', 'تابلت': '[TABLET]', 'تبلت': '[TABLET]', 'حبوب': '[TABLET]',
    'كبسول': '[CAPSULE]', 'كبسوله': '[CAPSULE]', 'كبسولات': '[CAPSULE]', 'كابسول': '[CAPSULE]',
    'شراب': '[SYRUP]', 'سائل': '[SYRUP]', 'معلق': '[SYRUP]', 'قطره': '[DROPS]', 'قطرة': '[DROPS]',
    'مرهم': '[CREAM]', 'كريم': '[CREAM]', 'جل': '[GEL]',
    'امبول': '[INJECTION]', 'حقنه': '[INJECTION]', 'ابره': '[INJECTION]', 'حقنة': '[INJECTION]', 'إبرة': '[INJECTION]',
    'فوار': '[EFFERVESCENT]', 'اكياس': '[SACHET]', 'أكياس': '[SACHET]', 'كيس': '[SACHET]', 'بخاخ': '[SPRAY]',
    // English terms unified too
    'tablet': '[TABLET]', 'tablets': '[TABLET]', 'tab': '[TABLET]', 'tabs': '[TABLET]',
    'capsule': '[CAPSULE]', 'capsules': '[CAPSULE]', 'cap': '[CAPSULE]', 'caps': '[CAPSULE]',
    'syrup': '[SYRUP]', 'drops': '[DROPS]', 'drop': '[DROPS]',
    'cream': '[CREAM]', 'ointment': '[CREAM]', 'gel': '[GEL]',
    'ampoule': '[INJECTION]', 'vial': '[INJECTION]', 'injection': '[INJECTION]',
    'effervescent': '[EFFERVESCENT]', 'sachet': '[SACHET]', 'spray': '[SPRAY]'
  };

  const words = s.split(' ').filter(Boolean);
  const unifiedWords = words.map(word => dosageDict[word] || word);

  return unifiedWords.join(' ');
}

/**
 * RapidFuzz fuzz.token_sort_ratio implementation:
 * Sorts tokens alphabetically and computes Levenshtein ratio
 */
export function tokenSortRatio(strA: string, strB: string): number {
  if (!strA && !strB) return 100;
  if (!strA || !strB) return 0;

  const sortedA = normalizeArabicMedicalText(strA).split(' ').filter(Boolean).sort().join(' ');
  const sortedB = normalizeArabicMedicalText(strB).split(' ').filter(Boolean).sort().join(' ');

  if (sortedA === sortedB) return 100;

  const totalLen = sortedA.length + sortedB.length;
  if (totalLen === 0) return 100;

  const dist = levenshteinDistance(sortedA, sortedB);
  const ratio = ((totalLen - dist) / totalLen) * 100;
  return Math.max(0, Math.min(100, Math.round(ratio * 100) / 100));
}

/**
 * MedicalInvoiceMatcher Class
 */
export class MedicalInvoiceMatcher {
  private systemCatalog: MedicalCatalogItem[];
  private priceTolerance: number;

  constructor(systemCatalog: MedicalCatalogItem[], priceTolerancePercentage = 5.0) {
    this.systemCatalog = systemCatalog.map(item => ({
      ...item,
      normalized_name: normalizeArabicMedicalText(item.item_name),
    }));
    this.priceTolerance = priceTolerancePercentage;
  }

  public setPriceTolerance(tol: number): void {
    this.priceTolerance = tol;
  }

  public getPriceTolerance(): number {
    return this.priceTolerance;
  }

  /**
   * البحث عن أفضل تطابق نصي وحساب نسبة الثقة بناءً على نظام النقاط الموزون
   * (الاسم 50%، السعر 30%، الكمية 20%) مع إضافة خيار المطابقة بالسعر (Price Fallback)
   */
  public calculateMatchScore(invoiceItem: MedicalInvoiceItemInput): MedicalMatchScoreResult | null {
    const invName = invoiceItem.item_name || '';
    const invPrice = Number(invoiceItem.unit_price) || 0.0;
    const invQty = Number(invoiceItem.quantity) || 0.0;

    if (!invName) {
      return null;
    }

    if (this.systemCatalog.length === 0) {
      return null;
    }

    const normInvName = normalizeArabicMedicalText(invName);

    // 1. البحث عن أفضل تطابق نصي في قاعدة بيانات النظام
    let bestMatchName = '';
    let nameScore = -1;
    let bestIndex = 0;

    this.systemCatalog.forEach((item, index) => {
      const targetNorm = item.normalized_name || normalizeArabicMedicalText(item.item_name);
      const score = tokenSortRatio(normInvName, targetNorm);
      if (score > nameScore) {
        nameScore = score;
        bestMatchName = item.item_name;
        bestIndex = index;
      }
    });

    const systemItem = this.systemCatalog[bestIndex];
    const sysPrice = Number(systemItem.item_price) || 0.0;
    const sysQty = systemItem.quantity !== undefined ? Number(systemItem.quantity) : -1;

    // 2. حساب تطابق السعر مع هامش التسامح (Price Tolerance Fallback)
    const priceDiffPercentage =
      sysPrice > 0 ? (Math.abs(invPrice - sysPrice) / sysPrice) * 100 : 100;

    let priceScore = 0.0;
    let priceStatus = 'غير متطابق';

    if (priceDiffPercentage < 0.01) {
      priceScore = 100.0;
      priceStatus = 'تطابق تام';
    } else if (priceDiffPercentage <= this.priceTolerance) {
      priceScore = 90.0; // فارق بسيط ضمن هامش التسامح
      priceStatus = `فارق بسيط (${priceDiffPercentage.toFixed(2)}%)`;
    } else {
      priceScore = 0.0;
      priceStatus = `غير متطابق (${priceDiffPercentage.toFixed(1)}%)`;
    }

    // 3. حساب تطابق الكمية
    // إذا كانت كمية النظام محددة > 0 ومطابقة، أو إذا تطابقت كمية الفاتورة مع كمية النظام
    let qtyScore = 0.0;
    if (invQty > 0 && sysQty > 0 && invQty === sysQty) {
      qtyScore = 100.0;
    } else if (invQty > 0 && sysQty === -1) {
      // إذا لم يكن في صنف النظام كمية محددة في المستودع، نعتبر الكمية مقبولة إذا كان السعر متطابقاً
      qtyScore = priceScore >= 90 ? 100.0 : 50.0;
    }

    // 4. المعادلة الموزونة الأساسية (الاسم 50%، السعر 30%، الكمية 20%)
    let finalConfidence = nameScore * 0.5 + priceScore * 0.3 + qtyScore * 0.2;

    // 5. تحديد الحالة الذكية (Auto-Accept Logic + Price Fallback)
    let status = 'يحتاج مراجعة';
    let matchReason = 'مطابقة نصية قياسية';
    let isPriceFallback = false;

    if (finalConfidence >= 95) {
      status = 'مطابق تماماً (تلقائي)';
      matchReason = 'تطابق عالي في الاسم والسعر والكمية';
    } else if (finalConfidence >= 85 && priceScore >= 90) {
      status = 'مطابق عالي الثقة (تلقائي)';
      matchReason = `تطابق الاسم (${nameScore}%) مع ${priceStatus}`;
    } else if (finalConfidence >= 75 && priceScore === 100 && qtyScore === 100) {
      status = 'مطابق (تلقائي - تطابق السعر والكمية)';
      matchReason = 'تطابق تام في السعر والكمية مع ثقة اسم مقبولة';
    }
    // ✨ الميزة الجديدة: المطابقة بالسعر كخط دفاع أخير (Price Fallback)
    else if (nameScore < 70 && qtyScore === 100 && priceScore >= 90) {
      status = 'مطابق محتمل (بناءً على السعر والكمية)';
      matchReason = `الاسم مختلف (${nameScore}%) ولكن السعر (${priceStatus}) والكمية متطابقان. يحتاج تأكيد سريع.`;
      isPriceFallback = true;
      // نرفع الثقة لتظهر في أعلى قائمة المراجعة
      finalConfidence = Math.max(finalConfidence, 80.0);
    }

    return {
      invoice_name: invName,
      system_name: systemItem.item_name,
      name_similarity: Math.round(nameScore * 100) / 100,
      price_match: priceScore >= 90,
      price_score: priceScore,
      price_diff: priceStatus,
      qty_match: qtyScore === 100,
      qty_score: qtyScore,
      final_confidence: Math.round(finalConfidence * 100) / 100,
      status,
      match_reason: matchReason,
      is_price_fallback: isPriceFallback,
      system_item: systemItem,
    };
  }
}

/**
 * 🧪 السيناريوهات التجريبية النموذجية من برومت المستخدم
 */
export const OFFICIAL_DEMO_SYSTEM_CATALOG: MedicalCatalogItem[] = [
  { item_name: 'جليماكس 5 مجم اقراص - العربية', item_price: 3065.0, quantity: 5 },
  { item_name: 'ريدوكسون فوار - ناتكو', item_price: 2580.0, quantity: 30 },
  { item_name: 'سيرولان اقراص 5 ملجم', item_price: 1850.0, quantity: 3 },
  { item_name: 'ريدوكسون فوار تاتكو', item_price: 2580.0, quantity: 1, barcode: '628100000001' },
  { item_name: 'سبروسان اقراص 500مجم سباء', item_price: 1850.0, quantity: 1, barcode: '628100000002' },
  { item_name: 'بانادول كولد اند فلو الاخضر المنصوب', item_price: 1565.0, quantity: 1, barcode: '628100000003' },
];

export const OFFICIAL_DEMO_INVOICE_ITEMS: MedicalInvoiceItemInput[] = [
  // سيناريو 1: تطابق مثالي
  { item_name: 'جليماكس اقراص العربية', unit_price: 3065.0, quantity: 5 },

  // سيناريو 2: الاسم مختلف تماماً لكن السعر والكمية مطابقان تماماً (خط الدفاع الأخير Price Fallback)
  { item_name: 'ميدوكلاس 5 مجم', unit_price: 1850.0, quantity: 3 },

  // سيناريو 3: الاسم مختلف، والسعر به فارق بسيط (1840 بدلاً من 1850)
  { item_name: 'سيرولاكس كبسول', unit_price: 1840.0, quantity: 3 },

  // سيناريو 4: تطابق الاسم، لكن السعر مختلف جداً (2000 بدلاً من 1850)
  { item_name: 'سيرولان اقراص 5 ملجم', unit_price: 2000.0, quantity: 3 },

  // سيناريو 5: ريدوكسون فوار - تاتكو (مع شرطة زيادة)
  { item_name: 'ريدوكسون فوار - تاتكو', unit_price: 2580.0, quantity: 1 },

  // سيناريو 6: ريتشارج فيتامين بلس كبسول مياس فارما (صنف جديد غير موجود)
  { item_name: 'ريتشارج فيتامين بلس كبسول مياس فارما', unit_price: 2798.0, quantity: 1 },
];

/**
 * ----------------------------------------------------
 * خوارزمية Python Difflib & SequenceMatcher المباشرة
 * ----------------------------------------------------
 */
export function cleanTextPython(text: string): string {
  if (!text) return '';
  // إزالة العلامات والرموز الخاصة مثل (-) والأقواس
  let s = text.replace(/[^\w\s\u0600-\u06FF]/g, ' ');
  // توحيد الأحرف العربية (الألف بأشكالها، التاء المربوطة، الياء)
  s = s.replace(/[إأآا]/g, 'ا');
  s = s.replace(/ة/g, 'ه');
  s = s.replace(/ى/g, 'ي');
  // إزالة المسافات الزائدة
  return s.split(/\s+/).filter(Boolean).join(' ').toLowerCase();
}

/**
 * دالة SequenceMatcher.ratio() من بايثون لحساب التشابه النصي
 */
export function sequenceMatcherRatio(a: string, b: string): number {
  if (!a && !b) return 1.0;
  if (!a || !b) return 0.0;
  if (a === b) return 1.0;

  // LCS-based sequence matching
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0 || lenB === 0) return 0.0;

  // Count matching blocks
  let matches = 0;
  let cursorA = 0;
  while (cursorA < lenA) {
    let bestBlockLen = 0;
    let bestBlockA = 0;
    for (let i = cursorA; i < lenA; i++) {
      for (let j = 0; j < lenB; j++) {
        let k = 0;
        while (i + k < lenA && j + k < lenB && a[i + k] === b[j + k]) {
          k++;
        }
        if (k > bestBlockLen) {
          bestBlockLen = k;
          bestBlockA = i;
        }
      }
    }
    if (bestBlockLen >= 2) {
      matches += bestBlockLen;
      cursorA = bestBlockA + bestBlockLen;
    } else {
      cursorA++;
    }
  }

  const ratio = (2.0 * matches) / (lenA + lenB);
  return Math.min(1.0, Math.max(0.0, ratio));
}

export interface PythonMatchResult {
  status: 'مطابق' | 'يحتاج مراجعة' | 'غير موجود';
  score: number;
  db_item: MedicalCatalogItem | null;
  is_found: boolean;
}

export function matchItemWithDatabasePython(
  invoiceItemName: string,
  dbItems: MedicalCatalogItem[],
  minScoreThreshold = 60
): PythonMatchResult {
  const cleanInvoiceItem = cleanTextPython(invoiceItemName);
  const wordsInvoice = new Set(cleanInvoiceItem.split(' ').filter(Boolean));

  let bestMatch: MedicalCatalogItem | null = null;
  let bestScore = 0;

  for (const dbItem of dbItems) {
    const cleanDbName = cleanTextPython(dbItem.item_name);

    // 1. مطابقة تامة بعد التنظيف
    if (cleanInvoiceItem === cleanDbName) {
      return {
        status: 'مطابق',
        score: 100,
        db_item: dbItem,
        is_found: true,
      };
    }

    const wordsDb = new Set(cleanDbName.split(' ').filter(Boolean));
    let hasCommonWord = false;
    for (const w of wordsInvoice) {
      if (wordsDb.has(w)) {
        hasCommonWord = true;
        break;
      }
    }

    // شرط أمان: إذا لم توجد أي كلمة أساسية مشتركة
    if (!hasCommonWord) {
      continue;
    }

    // حساب نسبة التشابه النصي SequenceMatcher
    const similarityRatio = sequenceMatcherRatio(cleanInvoiceItem, cleanDbName);
    const score = Math.round(similarityRatio * 100);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = dbItem;
    }
  }

  if (bestMatch && bestScore >= minScoreThreshold) {
    const status = bestScore >= 90 ? 'مطابق' : 'يحتاج مراجعة';
    return {
      status,
      score: bestScore,
      db_item: bestMatch,
      is_found: true,
    };
  }

  return {
    status: 'غير موجود',
    score: 0,
    db_item: null,
    is_found: false,
  };
}

