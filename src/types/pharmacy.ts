export type MatchStatus = 'MATCHED' | 'REVIEW_REQUIRED' | 'UNMATCHED' | 'ERROR';

export interface MasterItem {
  id: string;
  name: string; // Official name (e.g. "Panadol Extra 500mg/65mg Tab")
  nameAr?: string; // Arabic name (e.g. "بنادول اكسترا أقراص")
  barcode: string; // Official barcode (e.g. "6281001234567")
  price: number; // Official selling or system purchase price
  costPrice?: number;
  strength?: string; // e.g. "500mg/65mg", "10 ملغرام"
  strengthValue?: number;
  strengthUnit?: string;
  dosageForm?: string; // e.g. "Tablet", "Capsule", "Syrup", "أقراص"
  packSize?: string; // e.g. "24 Tabs", "10*10"
  packQty?: number;
  company?: string; // e.g. "GSK", "الغزالي", "الفتح"
  activeIngredient?: string; // e.g. "Paracetamol + Caffeine"
  category?: string;
  updatedAt?: string;
}

export interface SupplierInvoiceLine {
  rowNumber: number; // Strictly preserves original supplier invoice line number (1, 2, 3...)
  rawSupplierName: string;
  quantity: number;
  bonusQuantity?: number; // كمية البونص / المجاني
  unitPrice: number;
  effectiveUnitPrice?: number; // السعر الفعلي بعد البونص: الإجمالي ÷ (الكمية + البونص)
  totalPrice?: number;
  supplierBarcode?: string;
  extractedStrength?: string;
  extractedUnit?: string; // باكت، علبة، قارورة، إلخ
  extractedForm?: string;
  extractedPack?: string;
  expiryDate?: string;
  batchNumber?: string;
}

export interface ScoreBreakdown {
  coreNameScore: number;     // 0-100
  tokenScore: number;        // 0-100
  strengthScore: number;     // 0-100
  unitScore: number;         // 0-100
  companyScore: number;      // 0-100
  formScore: number;         // 0-100
  packScore: number;         // 0-100
  barcodeScore: number;      // 0-100
  aliasScore: number;        // 0-100
  finalCompositeScore: number; // 0-100
}

export interface PharmaEntity {
  raw: string;
  cleanText: string;
  coreName: string;             // Trade or core active name e.g. "سوبرانيل", "لينوبريل", "ديكلودنك"
  coreTokens: string[];
  strengthValue?: number;
  strengthUnit?: string;        // Normalized unit: "MG", "G", "MCG", "ML", "IU", "%"
  strengthRaw?: string;
  dosageForm?: string;          // Normalized: "TABLET", "CAPSULE", "SYRUP", "AMPOULE", etc.
  dosageFormLabel?: string;     // Arabic display: "أقراص", "كبسولات"
  packCount?: number;
  packRaw?: string;             // e.g. "10 شريط", "20 ك", "10*10"
  company?: string;             // e.g. "الغزالي", "الفتح", "الجبل"
  descriptors: string[];        // e.g. "ريتارد", "للفم", "روتاكاب"
}

export interface CandidateItem {
  masterItem: MasterItem;
  score: number; // 0 - 100%
  confidenceLevel: 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW';
  matchReason: string;
  agreementPoints: string[];   // أوجه الاتفاق
  differencePoints: string[];  // أوجه الاختلاف
  scoreBreakdown: ScoreBreakdown;
  hasBarcodeMatch: boolean;
  hasStrengthMatch: boolean;
  hasFormMatch: boolean;
  hasCompanyMatch: boolean;
  hardRulePassed: boolean;
  hardRuleViolations: string[];
  parsedEntity?: PharmaEntity;
  aiReasoning?: string;
}

export interface AIMatchAnalysis {
  isAiAssisted: boolean;
  confidenceScore: number;
  clinicalRationale: string;
  detectedActiveIngredient?: string;
  dosageFormConfirmed?: string;
  strengthConfirmed?: string;
  agreementPoints: string[];
  differencePoints: string[];
  safetyRiskLevel: 'SAFE' | 'WARNING' | 'CRITICAL_CONFLICT';
  safetyDetails?: string;
  modelUsed: string;
}

export interface MatchResult {
  rowNumber: number;
  invoiceLine: SupplierInvoiceLine;
  status: MatchStatus;
  confidenceScore: number; // 0 - 100
  matchedItem?: MasterItem;
  candidates: CandidateItem[];
  selectedCandidateId?: string;
  isManuallyConfirmed?: boolean;
  isPriceFallbackMatch?: boolean; // ✨ خط الدفاع الأخير: مطابقة بناء على تطابق السعر والكمية
  priceToleranceScore?: number;   // 0 - 100 (100% تطابق تام، 90% فارق بسيط)
  priceMatchStatus?: string;      // "تطابق تام", "فارق بسيط (X%)", "غير متطابق"
  nameSimilarityScore?: number;   // نسبة تشابه الاسم (token_sort_ratio)
  quantityMatchScore?: number;    // نسبة تطابق الكمية (100% أو 0%)
  reviewReason?: string;
  unmatchedReason?: string;
  notes?: string;
  parsedSupplierEntity?: PharmaEntity;
  aiAnalysis?: AIMatchAnalysis;
  // Price variance calculations
  priceDifference: number; // supplierPrice - masterPrice
  priceDiffPercentage: number; // ((supplierPrice - masterPrice) / masterPrice) * 100
  totalSupplierCost: number;
  totalMasterCost: number;
  totalDifference: number;
  bonusQuantity?: number;
  effectiveUnitPrice?: number;
  cheapestSupplierAlert?: {
    supplier: string;
    price: number;
    difference: number;
  };
}

export interface ConfirmedMapping {
  id: string;
  supplierNameCleaned: string; // Normalized string from supplier invoice
  supplierNameOriginal: string;
  masterItemId: string;
  masterItemName: string;
  officialBarcode: string;
  confidenceScore?: number;
  supplierCompany?: string;
  confirmedAt: string;
  timesUsed: number;
  lastUsedAt?: string;
}

export type DictionaryType = 'PRODUCT' | 'COMPANY' | 'FORM' | 'UNIT' | 'SUPPLIER';

export interface DictionaryEntry {
  id: string;
  type: DictionaryType;
  fromTerm: string;
  toTerm: string;
  supplierScope?: string; // If restricted to specific supplier
  notes?: string;
  isBuiltIn?: boolean;
  createdAt: string;
}

export interface InvoiceHeader {
  id: string;
  invoiceNumber: string;
  supplierName: string;
  invoiceDate: string;
  fileName?: string;
  importedAt: string;
  totalRows: number;
  matchedRows: number;
  reviewRows: number;
  unmatchedRows: number;
  errorRows: number;
  totalSupplierAmount: number;
  totalMasterAmount: number;
  totalPriceVariance: number;
  status: 'DRAFT' | 'REVIEWED' | 'CONFIRMED' | 'EXPORTED';
}

export interface StoredInvoice {
  header: InvoiceHeader;
  lines: SupplierInvoiceLine[];
  matchResults: MatchResult[];
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  user: string;
  invoiceId?: string;
}

export interface MasterColumnMapping {
  name: string;
  barcode: string;
  price: string;
  strength?: string;
  dosageForm?: string;
  packSize?: string;
  company?: string;
  activeIngredient?: string;
}

export interface SupplierColumnMapping {
  name: string;
  quantity: string;
  price: string;
  barcode?: string;
  total?: string;
  expiry?: string;
  batch?: string;
  bonus?: string;
  unit?: string;
}

export interface ScoringWeights {
  coreNameWeight: number; // default: 25
  strengthWeight: number; // default: 20
  companyWeight: number;  // default: 15
  formWeight: number;     // default: 10
  packWeight: number;     // default: 5
  barcodeWeight: number;  // default: 25
}

export interface AppSettings {
  pharmacyName: string;
  managerName?: string;
  license?: string;
  address?: string;
  phone?: string;
  currency: string;
  highConfidenceThreshold: number; // default: 92%
  reviewThreshold: number; // default: 75%
  autoLearnOnManualConfirm: boolean;
  exportColumns: string[];
  defaultExportFormat: 'xlsx' | 'csv';
  weights: ScoringWeights;
  googleSheetsWebAppUrl?: string;
  lastSheetsSync?: string;
}
