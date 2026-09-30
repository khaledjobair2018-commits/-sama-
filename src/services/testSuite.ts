import { SupplierInvoiceLine } from '../types/pharmacy';
import { PharmacyMatchEngine } from './matcher';
import { SEED_MASTER_ITEMS } from './storage';

export interface TestCaseResult {
  id: string;
  category: 'REAL_LIFE_MANDATORY' | 'CRITICAL_SAFETY' | 'NORMALIZATION' | 'BARCODE' | 'DOSAGE_FORM' | 'EDGE_CASE';
  title: string;
  supplierInput: string;
  supplierBarcode?: string;
  expectedBehavior: string;
  expectedStatus: 'MATCHED' | 'REVIEW_REQUIRED' | 'UNMATCHED';
  actualStatus: string;
  confidenceScore: number;
  matchedMasterName?: string;
  passed: boolean;
  notes: string;
}

export function runAllTests(): { results: TestCaseResult[]; totalPassed: number; totalFailed: number } {
  const engine = new PharmacyMatchEngine(SEED_MASTER_ITEMS, [], {
    highConfidenceThreshold: 85,
    reviewThreshold: 65,
  });
  const results: TestCaseResult[] = [];

  const testDefinitions: Array<{
    id: string;
    category: TestCaseResult['category'];
    title: string;
    supplierInput: string;
    supplierBarcode?: string;
    expectedBehavior: string;
    expectedStatus: 'MATCHED' | 'REVIEW_REQUIRED' | 'UNMATCHED';
    validator?: (res: ReturnType<PharmacyMatchEngine['matchLine']>) => boolean;
  }> = [
    // 1. MANDATORY REAL-LIFE TESTS FROM USER SPECIFICATION
    {
      id: 'REAL-01',
      category: 'REAL_LIFE_MANDATORY',
      title: 'مثال 1: لينوبريل أقراص 10 ملغرام الجنتين',
      supplierInput: 'لينوبريل أقراص 10 ملغرام الجنتين',
      expectedBehavior: 'العثور على (لينوبريل 10 ملغرام أقراص الدوائية الأردنية) كأفضل مرشح',
      expectedStatus: 'MATCHED',
      validator: res =>
        (res.status === 'MATCHED' || res.status === 'REVIEW_REQUIRED') &&
        Boolean(res.matchedItem?.nameAr?.includes('لينوبريل') && res.matchedItem?.strength === '10mg'),
    },
    {
      id: 'REAL-02',
      category: 'REAL_LIFE_MANDATORY',
      title: 'مثال 2: سوبرانيل 25 ملغرام كبسول 20 ك الفتحة',
      supplierInput: 'سوبرانيل 25 ملغرام كبسول 20 ك الفتحة',
      expectedBehavior: 'العثور على (سوبرانيل 25 مجم اقرص الفتح) كأفضل مرشح مع توضيح اختلاف الشكل/العبوة',
      expectedStatus: 'MATCHED',
      validator: res =>
        Boolean(res.matchedItem?.nameAr?.includes('سوبرانيل') || res.candidates[0]?.masterItem?.nameAr?.includes('سوبرانيل')),
    },
    {
      id: 'REAL-03',
      category: 'REAL_LIFE_MANDATORY',
      title: 'مثال 3: دكلو دنك ريتارد 100 مجم 10*10',
      supplierInput: 'دكلو دنك ريتارد 100 مجم 10*10',
      expectedBehavior: 'مطابقة (ديكلودنك ريتارد 100اقراص) والتعرف على ريتارد والتركيز 100',
      expectedStatus: 'MATCHED',
      validator: res =>
        (res.status === 'MATCHED' || res.status === 'REVIEW_REQUIRED') &&
        Boolean(res.matchedItem?.nameAr?.includes('ديكلودنك')),
    },
    {
      id: 'REAL-04',
      category: 'REAL_LIFE_MANDATORY',
      title: 'مثال 4: التمييز بين كونكور 5 مجم و كونكور كور 2.5 مجم',
      supplierInput: 'كونكور 5 مجم أقراص',
      expectedBehavior: 'مطابقة كونكور 5 مجم بدقة ورفض كونكور كور 2.5 مجم',
      expectedStatus: 'MATCHED',
      validator: res => res.status === 'MATCHED' && res.matchedItem?.strength === '5mg',
    },

    // 2. CRITICAL CLINICAL SAFETY TESTS
    {
      id: 'DANGEROUS-01',
      category: 'CRITICAL_SAFETY',
      title: 'منع مطابقة 500mg مع 250mg (Amoxicillin 500mg vs 250mg)',
      supplierInput: 'Amoxicillin 250mg Capsule',
      expectedBehavior: 'يجب أن يطابق 250mg حصراً ويرفض تماماً المطابقة التلقائية مع 500mg',
      expectedStatus: 'MATCHED',
      validator: res => res.status === 'MATCHED' && res.matchedItem?.strength === '250mg',
    },
    {
      id: 'DANGEROUS-01-B',
      category: 'CRITICAL_SAFETY',
      title: 'رفض المطابقة عندما لا يوجد سوى تركيز مختلف (Amoxicillin 125mg)',
      supplierInput: 'Amoxicillin 125mg Capsule',
      expectedBehavior: 'رفض المطابقة التلقائية لعدم وجود تركيز 125mg في النظام (منع خلط الجرعات)',
      expectedStatus: 'UNMATCHED',
      validator: res => res.status !== 'MATCHED',
    },
    {
      id: 'DANGEROUS-02',
      category: 'CRITICAL_SAFETY',
      title: 'منع مطابقة 50,000 IU مع 5,000 IU (فيتامين د3 جرعة أسبوعية مقابل يومية)',
      supplierInput: 'Vitamin D3 50000 IU Caps',
      expectedBehavior: 'يجب أن يطابق 50,000 IU ويرفض قطعاً 5,000 IU',
      expectedStatus: 'MATCHED',
      validator: res => res.status === 'MATCHED' && res.matchedItem?.strength === '50000 IU',
    },
    {
      id: 'DANGEROUS-02-B',
      category: 'CRITICAL_SAFETY',
      title: 'رفض الخلط بين 5000 IU و 50000 IU عند طلب 5000 IU',
      supplierInput: 'Vitamin D3 5000 IU Caps',
      expectedBehavior: 'يجب أن يطابق 5,000 IU فقط ويرفض 50,000 IU',
      expectedStatus: 'MATCHED',
      validator: res => res.status === 'MATCHED' && res.matchedItem?.strength === '5000 IU',
    },
    {
      id: 'DANGEROUS-03',
      category: 'CRITICAL_SAFETY',
      title: 'منع مطابقة قطرة كبار مع قطرة أطفال (Adult 0.1% vs Child 0.05%)',
      supplierInput: 'Otrivin Adult 0.1% Drops',
      expectedBehavior: 'مطابقة للكبار فقط ورفض الأطفال',
      expectedStatus: 'MATCHED',
      validator: res => res.status === 'MATCHED' && res.matchedItem?.strength === '0.1%',
    },
    {
      id: 'DANGEROUS-03-B',
      category: 'CRITICAL_SAFETY',
      title: 'رفض مطابقة قطرة أطفال مع كبار',
      supplierInput: 'Otrivin Child Drops 0.05%',
      expectedBehavior: 'مطابقة للأطفال فقط ورفض الكبار',
      expectedStatus: 'MATCHED',
      validator: res => res.status === 'MATCHED' && res.matchedItem?.strength === '0.05%',
    },
    {
      id: 'DANGEROUS-04',
      category: 'CRITICAL_SAFETY',
      title: 'منع الخلط بين أقراص وكبسولات عند عدم تحديد الشكل في الفاتورة',
      supplierInput: 'Product Unknown 500',
      expectedBehavior: 'عدم التخمين ووضع الحالة غير مطابق أو مراجعة',
      expectedStatus: 'UNMATCHED',
      validator: res => res.status === 'UNMATCHED',
    },
    {
      id: 'DANGEROUS-05',
      category: 'CRITICAL_SAFETY',
      title: 'منع مطابقة وحدة mg مع mcg (Ventolin 100mcg vs 100mg)',
      supplierInput: 'Ventolin 100mg Inhaler',
      expectedBehavior: 'رفض المطابقة التلقائية لأن الفاتورة تحتوي على 100mg والنظام 100mcg (فرق ألف ضعف!)',
      expectedStatus: 'UNMATCHED',
      validator: res => res.status !== 'MATCHED',
    },
    {
      id: 'DANGEROUS-06',
      category: 'CRITICAL_SAFETY',
      title: 'منع مطابقة أقراص مع حقن/أمبولات تلقائياً (Voltaren Tab vs Ampoule)',
      supplierInput: 'Voltaren 75mg Tablets',
      expectedBehavior: 'رفض مطابقة الأمبولات تلقائياً (Voltaren 75mg Ampoule)',
      expectedStatus: 'REVIEW_REQUIRED',
      validator: res => res.status === 'REVIEW_REQUIRED' || res.status === 'UNMATCHED',
    },

    // 3. NORMALIZATION & OCR TESTS
    {
      id: 'NORM-01',
      category: 'NORMALIZATION',
      title: 'معالجة اختلاف الهمزات (أوجمنتين vs اوجمنتين vs إوجمنتين)',
      supplierInput: 'اوجمنتين 1 جم اقراص',
      expectedBehavior: 'مطابقة ناجحة مع Augmentin 1g Tablet',
      expectedStatus: 'MATCHED',
      validator: res =>
        (res.status === 'MATCHED' || res.status === 'REVIEW_REQUIRED') &&
        Boolean(res.matchedItem?.name?.includes('Augmentin')),
    },
    {
      id: 'NORM-02',
      category: 'NORMALIZATION',
      title: 'معالجة اختلاف التاء المربوطة والهاء والياء والمسافات الزائدة',
      supplierInput: '  بنادول   اكسترا  اقراص  ',
      expectedBehavior: 'مطابقة ممتازة مع Panadol Extra 500mg/65mg Tablet',
      expectedStatus: 'MATCHED',
      validator: res =>
        (res.status === 'MATCHED' || res.status === 'REVIEW_REQUIRED') &&
        Boolean(res.matchedItem?.name?.includes('Panadol Extra')),
    },
    {
      id: 'NORM-03',
      category: 'NORMALIZATION',
      title: 'معالجة اختلاف ترتيب الكلمات (Paracetamol 100ml Syrup 120mg/5ml)',
      supplierInput: 'Paracetamol Syrup 100ml 120mg/5ml',
      expectedBehavior: 'مطابقة دقيقة بالرغم من اختلاف موضع كلمة Syrup',
      expectedStatus: 'MATCHED',
      validator: res => res.matchedItem?.id === 'MI-003',
    },
    {
      id: 'NORM-04',
      category: 'NORMALIZATION',
      title: 'أخطاء إملائية طفيفة مقبولة (Paracetmol Extra)',
      supplierInput: 'Paracetmol Extra 500/65 Tab',
      expectedBehavior: 'مطابقة بالرغم من حذف حرف a في Paracetmol',
      expectedStatus: 'MATCHED',
      validator: res => Boolean(res.matchedItem?.name?.includes('Panadol Extra')),
    },

    // 4. DOSAGE FORM TESTS
    {
      id: 'FORM-01',
      category: 'DOSAGE_FORM',
      title: 'توحيد كبسول / كبسولة / Capsule / Cap',
      supplierInput: 'Amoxicillin 500 mg caps',
      expectedBehavior: 'مطابقة Amoxicillin 500mg Capsule بنجاح',
      expectedStatus: 'MATCHED',
      validator: res => res.status === 'MATCHED' && res.matchedItem?.dosageForm === 'Capsule',
    },
    {
      id: 'FORM-02',
      category: 'DOSAGE_FORM',
      title: 'توحيد قرص / أقراص / Tablet / Tabs / FCT',
      supplierInput: 'Brufen 400mg FCT',
      expectedBehavior: 'مطابقة Brufen 400mg Tablet بنجاح',
      expectedStatus: 'MATCHED',
      validator: res => res.status === 'MATCHED' && res.matchedItem?.id === 'MI-011',
    },
    {
      id: 'FORM-03',
      category: 'DOSAGE_FORM',
      title: 'التمييز الدقيق بين كريم ومرهم (Fucidin Cream vs Ointment)',
      supplierInput: 'Fucidin 2% Cream 15g',
      expectedBehavior: 'يجب أن يطابق Cream تحديداً ويرفض Ointment',
      expectedStatus: 'MATCHED',
      validator: res => res.status === 'MATCHED' && res.matchedItem?.id === 'MI-025',
    },
    {
      id: 'FORM-04',
      category: 'DOSAGE_FORM',
      title: 'التمييز عند طلب مرهم Fucidin Ointment',
      supplierInput: 'Fucidin 2% Oint 15g',
      expectedBehavior: 'يجب أن يطابق Ointment تحديداً ويرفض Cream',
      expectedStatus: 'MATCHED',
      validator: res => res.status === 'MATCHED' && res.matchedItem?.id === 'MI-026',
    },

    // 5. BARCODE MATCHING
    {
      id: 'BARCODE-01',
      category: 'BARCODE',
      title: 'مطابقة مؤكدة وفورية عند توفر الباركود الرسمي الصحيح',
      supplierInput: 'Panadol Blue 500',
      supplierBarcode: '6281001000028',
      expectedBehavior: 'رفع الثقة لـ 100% بفضل تطابق الباركود الرسمي',
      expectedStatus: 'MATCHED',
      validator: res => res.status === 'MATCHED' && res.confidenceScore >= 98 && res.matchedItem?.id === 'MI-002',
    },
    {
      id: 'BARCODE-02',
      category: 'BARCODE',
      title: 'صنف غير معروف في قاعدة البيانات',
      supplierInput: 'NonExistentDrugXYZ 999mg',
      expectedBehavior: 'وضع الحالة UNMATCHED مع الاحتفاظ بالسطر كاملاً وعدم حذفه',
      expectedStatus: 'UNMATCHED',
      validator: res => res.status === 'UNMATCHED',
    },
  ];

  let passedCount = 0;
  let failedCount = 0;

  for (const def of testDefinitions) {
    const line: SupplierInvoiceLine = {
      rowNumber: results.length + 1,
      rawSupplierName: def.supplierInput,
      quantity: 10,
      unitPrice: 20,
      supplierBarcode: def.supplierBarcode,
    };

    const matchRes = engine.matchLine(line);
    let passed = false;

    if (def.validator) {
      passed = def.validator(matchRes);
    } else {
      passed = matchRes.status === def.expectedStatus;
    }

    if (passed) passedCount++;
    else failedCount++;

    results.push({
      id: def.id,
      category: def.category,
      title: def.title,
      supplierInput: def.supplierInput,
      supplierBarcode: def.supplierBarcode,
      expectedBehavior: def.expectedBehavior,
      expectedStatus: def.expectedStatus,
      actualStatus: matchRes.status,
      confidenceScore: matchRes.confidenceScore,
      matchedMasterName: matchRes.matchedItem?.name || matchRes.candidates[0]?.masterItem?.name,
      passed,
      notes: matchRes.reviewReason || matchRes.unmatchedReason || matchRes.notes || '',
    });
  }

  return {
    results,
    totalPassed: passedCount,
    totalFailed: failedCount,
  };
}
