import React, { useState, useMemo } from 'react';
import {
  SlidersHorizontal,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  ShieldCheck,
  Search,
  RotateCcw,
  Save,
  Pill,
  Building2,
  Scale,
  Package,
  ArrowRight,
  Info,
  Check,
  ChevronRight,
  Cpu,
  Bot,
} from 'lucide-react';
import {
  MasterItem,
  ScoringWeights,
  CandidateItem,
  MatchResult,
} from '../types/pharmacy';
import { PharmacyMatchEngine } from '../services/matcher';
import { extractPharmaEntity } from '../services/extractor';
import { aiMatchService, SingleLineAIResponse } from '../services/aiMatcher';

interface MatchEngineTestViewProps {
  masterItems: MasterItem[];
  currentWeights: ScoringWeights;
  onSaveWeights: (weights: ScoringWeights) => void;
  currency: string;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  coreNameWeight: 35,
  strengthWeight: 25,
  formWeight: 15,
  packWeight: 10,
  companyWeight: 10,
  barcodeWeight: 25,
};

const PRESET_TEST_CASES = [
  {
    label: '🎯 سيناريو 1: جليماكس اقراص العربية (تطابق مثالي)',
    query: 'جليماكس اقراص العربية',
    price: 3065.00,
    quantity: 5,
    category: 'official-python',
    notes: 'تطابق مثالي في الاسم والسعر (3065) والكمية (5)',
  },
  {
    label: '✨ سيناريو (1): ريدوكسون فوار - تاتكو (SequenceMatcher)',
    query: 'ريدوكسون فوار - تاتكو',
    price: 2580.00,
    quantity: 1,
    category: 'official-python',
    notes: 'صنف موجود ومطابق مع شرطة زيادة (تنظيف الرموز وتوحيد الأحرف)',
  },
  {
    label: '🆕 سيناريو (2): ريتشارج فيتامين بلس (صنف جديد غير موجود)',
    query: 'ريتشارج فيتامين بلس كبسول مياس فارما',
    price: 2798.00,
    quantity: 1,
    category: 'official-python',
    notes: 'صنف غير موجود في قاعدة البيانات، يتطلب توجيهه للإضافة السريعة',
  },
  {
    label: '✨ سيناريو 2: ميدوكلاس 5 مجم (خط الدفاع بالسعر والكمية)',
    query: 'ميدوكلاس 5 مجم',
    price: 1850.00,
    quantity: 3,
    category: 'official-python',
    notes: 'الاسم مختلف تماماً عن سيرولان، لكن السعر 1850 والكمية 3 متطابقان تماماً',
  },
  {
    label: '✨ سيناريو 3: سيرولاكس كبسول (فارق سعر 0.54% ضمن 5%)',
    query: 'سيرولاكس كبسول',
    price: 1840.00,
    quantity: 3,
    category: 'official-python',
    notes: 'السعر 1840 مقابل 1850 بفارق بسيط ضمن هامش التسامح 5%',
  },
  {
    label: '⚠️ سيناريو 4: سيرولان اقراص 5 ملجم (فارق سعر كبير)',
    query: 'سيرولان اقراص 5 ملجم',
    price: 2000.00,
    quantity: 3,
    category: 'official-python',
    notes: 'تطابق الاسم مع فارق سعر كبير 2000 بدلاً من 1850',
  },
  {
    label: 'مثال 1: لينوبريل أقراص الجنتين',
    query: 'لينوبريل أقراص 10 ملغرام الجنتين',
    price: 25.00,
    quantity: 1,
    category: 'real-life',
    notes: 'اختلاف ترتيب الكلمات واسم الموزع (الجنتين vs الدوائية الأردنية)',
  },
  {
    label: 'مثال 2: سوبرانيل كبسول الفتحة',
    query: 'سوبرانيل 25 ملغرام كبسول 20 ك الفتحة',
    price: 19.00,
    quantity: 1,
    category: 'real-life',
    notes: 'اختلاف الشكل (كبسول مقابل اقرص) والعبوة (20 ك)',
  },
  {
    label: 'مثال 3: دكلو دنك ريتارد 10*10',
    query: 'دكلو دنك ريتارد 100 مجم 10*10',
    price: 24.00,
    quantity: 1,
    category: 'real-life',
    notes: 'كلمة مركبة منفصلة (دكلو دنك)، ممتد المفعول (ريتارد)، عبوة 10*10',
  },
  {
    label: 'خطر جرعات: أموكسيسيلين 250mg',
    query: 'Amoxicillin 250mg Capsule',
    price: 13.50,
    quantity: 1,
    category: 'danger',
    notes: 'يجب أن يطابق 250mg بدقة ويرفض منعاً باتاً المطابقة مع 500mg',
  },
  {
    label: 'خطر جرعات: فيتامين د3 50,000 IU',
    query: 'Vitamin D3 50000 IU Caps',
    price: 45.00,
    quantity: 1,
    category: 'danger',
    notes: 'منع الخلط القاتل بين الجرعة الأسبوعية 50,000 واليومية 5,000',
  },
  {
    label: 'وحدات خطيرة: فنتولين 100mg vs 100mcg',
    query: 'Ventolin 100mg Inhaler',
    price: 19.80,
    quantity: 1,
    category: 'danger',
    notes: 'فارق 1000 ضعف بين الميكروجرام والمليجرام',
  },
  {
    label: 'أشكال متضاربة: فولتارين أقراص vs أمبولات',
    query: 'Voltaren 75mg Tablets',
    price: 21.00,
    quantity: 1,
    category: 'form',
    notes: 'منع مطابقة الأقراص مع أمبولات الحقن Voltaren 75mg Ampoule',
  },
  {
    label: 'تمييز دقيق: كونكور 5 vs كونكور كور 2.5',
    query: 'كونكور 5 مجم أقراص',
    price: 32.50,
    quantity: 1,
    category: 'distinction',
    notes: 'التمييز بين عائلة Concor و Concor Cor',
  },
  {
    label: 'همزات: اوجمنتين 1 جم اقراص',
    query: 'اوجمنتين 1 جم اقراص',
    price: 49.85,
    quantity: 1,
    category: 'normalization',
    notes: 'معالجة اختلاف الهمزات (اوجمنتين مقابل Augmentin)',
  },
];

export const MatchEngineTestView: React.FC<MatchEngineTestViewProps> = ({
  masterItems,
  currentWeights,
  onSaveWeights,
  currency,
}) => {
  // Test Input State
  const [supplierInput, setSupplierInput] = useState('جليماكس اقراص العربية');
  const [supplierBarcode, setSupplierBarcode] = useState('');
  const [testUnitPrice, setTestUnitPrice] = useState<number>(3065);
  const [testQuantity, setTestQuantity] = useState<number>(5);
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState(0);
  const [aiAnalysis, setAiAnalysis] = useState<SingleLineAIResponse['result'] | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Manual 1-on-1 comparison search
  const [manualMasterSearch, setManualMasterSearch] = useState('');
  const [selectedManualMaster, setSelectedManualMaster] = useState<MasterItem | null>(null);

  // Interactive Local Weights State
  const [weights, setWeights] = useState<ScoringWeights>(currentWeights || DEFAULT_WEIGHTS);
  const [isSavedNotice, setIsSavedNotice] = useState(false);

  // Initialize engine with local weights
  const engine = useMemo(() => {
    return new PharmacyMatchEngine(masterItems, [], {
      highConfidenceThreshold: 85,
      reviewThreshold: 65,
      weights,
    });
  }, [masterItems, weights]);

  // Entity Extraction from Supplier Text
  const supplierEntity = useMemo(() => {
    return extractPharmaEntity(supplierInput);
  }, [supplierInput]);

  // Run full match against all master items
  const matchResult: MatchResult | null = useMemo(() => {
    if (!supplierInput.trim()) return null;
    return engine.matchLine({
      rowNumber: 1,
      rawSupplierName: supplierInput,
      quantity: testQuantity > 0 ? testQuantity : 1,
      unitPrice: testUnitPrice >= 0 ? testUnitPrice : 0,
      supplierBarcode: supplierBarcode.trim() || undefined,
    });
  }, [engine, supplierInput, supplierBarcode, testQuantity, testUnitPrice]);

  // Inspect 1-on-1 manual master item if chosen, otherwise inspect top candidate
  const inspectedCandidate: CandidateItem | null = useMemo(() => {
    if (selectedManualMaster) {
      return engine.evaluateSinglePair(supplierInput, selectedManualMaster, supplierBarcode);
    }
    if (matchResult && matchResult.candidates.length > 0) {
      return matchResult.candidates[selectedCandidateIndex] || matchResult.candidates[0];
    }
    return null;
  }, [selectedManualMaster, engine, supplierInput, supplierBarcode, matchResult, selectedCandidateIndex]);

  // Weight Handlers
  const handleWeightChange = (key: keyof ScoringWeights, val: number) => {
    setWeights(prev => ({
      ...prev,
      [key]: Math.max(0, Math.min(100, val)),
    }));
    setIsSavedNotice(false);
  };

  const handleResetWeights = () => {
    setWeights(DEFAULT_WEIGHTS);
    setIsSavedNotice(false);
  };

  const handleSaveWeightsToSystem = () => {
    onSaveWeights(weights);
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 3000);
  };

  const handleRunAiTest = async () => {
    if (!supplierInput.trim() || !matchResult) return;
    setIsAiLoading(true);
    try {
      const res = await aiMatchService.matchLine(
        {
          rowNumber: 1,
          rawSupplierName: supplierInput,
          supplierBarcode: supplierBarcode.trim() || undefined,
          quantity: 1,
          unitPrice: 25,
        },
        matchResult.candidates
      );
      setAiAnalysis(res);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Filter master items for manual 1-on-1 search
  const searchResultsMaster = useMemo(() => {
    if (!manualMasterSearch.trim()) return [];
    const q = manualMasterSearch.toLowerCase();
    return masterItems
      .filter(
        item =>
          item.name.toLowerCase().includes(q) ||
          (item.nameAr && item.nameAr.includes(q)) ||
          item.barcode.includes(q) ||
          (item.activeIngredient && item.activeIngredient.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [masterItems, manualMasterSearch]);

  // Total weights sum
  const totalWeightSum =
    weights.coreNameWeight +
    weights.strengthWeight +
    weights.formWeight +
    weights.packWeight +
    weights.companyWeight;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ============================================================ */}
      {/* 1. HEADER BANNER */}
      {/* ============================================================ */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 space-x-reverse mb-1.5">
            <div className="p-2.5 bg-gradient-to-tr from-emerald-600 to-teal-500 text-white rounded-xl shadow-md shadow-emerald-600/20">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <h1 className="text-xl font-black text-slate-900">
                  MATCH ENGINE TEST — مختبر فحص وضبط محرك المطابقة
                </h1>
                <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                  Live Dynamic Inspector
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                أداة تفاعلية للمقارنة الفورية لأصناف الفواتير مع قاعدة الأصناف، مع عرض تفصيلي لدرجات
                المطابقة (Score Breakdown) وإمكانية تعديل أوزان العناصر وملاحظة تأثيرها فورياً.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 space-x-reverse self-start md:self-auto">
          {isSavedNotice && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center space-x-1 space-x-reverse animate-fade-in">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>تم حفظ الأوزان للنظام!</span>
            </span>
          )}
          <button
            onClick={handleSaveWeightsToSystem}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition flex items-center space-x-1.5 space-x-reverse cursor-pointer"
            title="حفظ الأوزان الحالية لتطبيقها على مطابقة الفواتير في النظام بالكامل"
          >
            <Save className="w-4 h-4" />
            <span>حفظ الأوزان للنظام ككل</span>
          </button>
          <button
            onClick={handleResetWeights}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl transition flex items-center space-x-1 space-x-reverse cursor-pointer"
            title="استعادة الأوزان القياسية الافتراضية"
          >
            <RotateCcw className="w-4 h-4" />
            <span>الافتراضية</span>
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. PRESET TEST BUTTONS */}
      {/* ============================================================ */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-2 space-x-reverse mb-2.5">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-bold text-slate-800">
            أمثلة وتجارب سريعة جاهزة للفحص الفوري:
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESET_TEST_CASES.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => {
                setSupplierInput(preset.query);
                setSupplierBarcode('');
                if (preset.price !== undefined) setTestUnitPrice(preset.price);
                if (preset.quantity !== undefined) setTestQuantity(preset.quantity);
                setSelectedManualMaster(null);
                setSelectedCandidateIndex(0);
              }}
              className={`text-xs px-3 py-1.5 rounded-xl border transition cursor-pointer text-right flex items-center space-x-1.5 space-x-reverse ${
                supplierInput === preset.query
                  ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs'
                  : preset.category === 'official-python'
                  ? 'bg-cyan-50 text-cyan-800 border-cyan-300 hover:bg-cyan-100 font-bold'
                  : preset.category === 'danger'
                  ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 font-medium'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. INPUT FORM & EXTRACTED ENTITY CHIPS */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Input Form (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center space-x-2 space-x-reverse">
              <Zap className="w-4 h-4 text-emerald-600" />
              <span>مدخلات سطر فاتورة المورد:</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم الصنف كما هو مكتوب في فاتورة المورد:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={supplierInput}
                    onChange={e => {
                      setSupplierInput(e.target.value);
                      setSelectedManualMaster(null);
                      setSelectedCandidateIndex(0);
                    }}
                    placeholder="اكتب اسم الصنف في الفاتورة، مثلاً: لينوبريل أقراص 10 ملغرام الجنتين..."
                    className="w-full text-sm font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                  />
                  {supplierInput && (
                    <button
                      onClick={() => setSupplierInput('')}
                      className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      مسح
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    الباركود الوارد في الفاتورة (اختياري):
                  </label>
                  <input
                    type="text"
                    value={supplierBarcode}
                    onChange={e => {
                      setSupplierBarcode(e.target.value);
                      setSelectedManualMaster(null);
                    }}
                    placeholder="مثال: 6281001000011"
                    className="w-full text-xs font-mono border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    سعر وحدة المورد (unit_price):
                  </label>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <input
                      type="number"
                      step="0.01"
                      value={testUnitPrice}
                      onChange={e => setTestUnitPrice(parseFloat(e.target.value) || 0)}
                      className="w-full text-xs font-mono font-bold border border-slate-300 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-xs text-slate-500 font-bold">{currency}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    الكمية الواردة (quantity):
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={testQuantity}
                    onChange={e => setTestQuantity(parseInt(e.target.value) || 1)}
                    className="w-full text-xs font-mono font-bold border border-slate-300 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* AI Test Trigger */}
              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleRunAiTest}
                  disabled={isAiLoading || !supplierInput.trim()}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition flex items-center space-x-2 space-x-reverse shadow-xs disabled:opacity-50 cursor-pointer self-start sm:self-auto"
                >
                  <Sparkles className={`w-4 h-4 text-purple-200 ${isAiLoading ? 'animate-spin' : ''}`} />
                  <span>
                    {isAiLoading
                      ? 'جارِ المطابقة بالذكاء الاصطناعي...'
                      : 'فحص ومطابقة بالذكاء الاصطناعي (Gemini 3.8 Flash)'}
                  </span>
                </button>
                <span className="text-[11px] text-slate-500 font-medium">
                  يحلل الصنف عبر نموذج Gemini 3.8 Flash مع حماية الجرعات الصارمة
                </span>
              </div>
            </div>
          </div>

          {/* Extracted Entity Visualization */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-800">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-2 space-x-reverse">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold">
                  تفكيك الكيانات السريرية للمدخل (Clinical Entity Extraction):
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {supplierEntity.coreTokens.length} مفردات مستخرجة
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700/80">
                <span className="text-[10px] text-slate-400 block font-medium">الاسم التجاري الأساسي:</span>
                <span className="font-bold text-emerald-400 text-sm truncate block mt-0.5">
                  {supplierEntity.coreName || '—'}
                </span>
              </div>

              <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700/80">
                <span className="text-[10px] text-slate-400 block font-medium">التركيز والوحدة:</span>
                <span className="font-bold text-blue-400 text-sm block mt-0.5">
                  {supplierEntity.strengthRaw ||
                    (supplierEntity.strengthValue
                      ? `${supplierEntity.strengthValue} ${supplierEntity.strengthUnit || ''}`
                      : 'غير محدد')}
                </span>
              </div>

              <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700/80">
                <span className="text-[10px] text-slate-400 block font-medium">الشكل الدوائي المستخرج:</span>
                <span className="font-bold text-purple-400 text-sm block mt-0.5">
                  {supplierEntity.dosageFormLabel || supplierEntity.dosageForm || 'غير محدد'}
                </span>
              </div>

              <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700/80">
                <span className="text-[10px] text-slate-400 block font-medium">حجم العبوة:</span>
                <span className="font-bold text-amber-400 text-sm block mt-0.5 font-mono">
                  {supplierEntity.packRaw || (supplierEntity.packCount ? `${supplierEntity.packCount} وحدة` : 'غير محدد')}
                </span>
              </div>

              <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700/80">
                <span className="text-[10px] text-slate-400 block font-medium">الشركة / الموزع:</span>
                <span className="font-bold text-cyan-400 text-sm block mt-0.5">
                  {supplierEntity.company || 'غير محدد'}
                </span>
              </div>

              <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700/80">
                <span className="text-[10px] text-slate-400 block font-medium">الخصائص والمحددات:</span>
                <span className="font-bold text-pink-400 text-sm block mt-0.5">
                  {supplierEntity.descriptors.length > 0
                    ? supplierEntity.descriptors.join(', ')
                    : 'عادي'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic Weight Sliders Panel (1 col) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2 space-x-reverse">
                <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">أوزان المطابقة التفاعلية:</h3>
              </div>
              <span className="text-[11px] font-mono text-slate-500 font-bold">
                المجموع: {totalWeightSum}%
              </span>
            </div>

            <p className="text-[11px] text-slate-500 mb-4">
              حرك المؤشرات لتعديل وزن كل عنصر ولاحظ التحديث الفوري المباشر لدرجات المطابقة وترتيب
              المرشحين:
            </p>

            <div className="space-y-3.5 text-xs">
              {/* 1. Core Name Weight */}
              <div>
                <div className="flex justify-between font-bold text-slate-700 mb-1">
                  <span className="flex items-center space-x-1.5 space-x-reverse">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                    <span>وزن الاسم التجاري الأساسي:</span>
                  </span>
                  <span className="font-mono text-emerald-700">{weights.coreNameWeight}%</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={60}
                  step={5}
                  value={weights.coreNameWeight}
                  onChange={e => handleWeightChange('coreNameWeight', parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
              </div>

              {/* 2. Strength Weight */}
              <div>
                <div className="flex justify-between font-bold text-slate-700 mb-1">
                  <span className="flex items-center space-x-1.5 space-x-reverse">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
                    <span>وزن التركيز الدوائي:</span>
                  </span>
                  <span className="font-mono text-blue-700">{weights.strengthWeight}%</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={50}
                  step={5}
                  value={weights.strengthWeight}
                  onChange={e => handleWeightChange('strengthWeight', parseInt(e.target.value, 10))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              {/* 3. Dosage Form Weight */}
              <div>
                <div className="flex justify-between font-bold text-slate-700 mb-1">
                  <span className="flex items-center space-x-1.5 space-x-reverse">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block"></span>
                    <span>وزن الشكل الدوائي:</span>
                  </span>
                  <span className="font-mono text-purple-700">{weights.formWeight}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={30}
                  step={5}
                  value={weights.formWeight}
                  onChange={e => handleWeightChange('formWeight', parseInt(e.target.value, 10))}
                  className="w-full accent-purple-600 cursor-pointer"
                />
              </div>

              {/* 4. Pack Size Weight */}
              <div>
                <div className="flex justify-between font-bold text-slate-700 mb-1">
                  <span className="flex items-center space-x-1.5 space-x-reverse">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                    <span>وزن حجم العبوة:</span>
                  </span>
                  <span className="font-mono text-amber-700">{weights.packWeight}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={25}
                  step={5}
                  value={weights.packWeight}
                  onChange={e => handleWeightChange('packWeight', parseInt(e.target.value, 10))}
                  className="w-full accent-amber-600 cursor-pointer"
                />
              </div>

              {/* 5. Company Weight */}
              <div>
                <div className="flex justify-between font-bold text-slate-700 mb-1">
                  <span className="flex items-center space-x-1.5 space-x-reverse">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block"></span>
                    <span>وزن الشركة المصنعة / الموزع:</span>
                  </span>
                  <span className="font-mono text-cyan-700">{weights.companyWeight}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={30}
                  step={5}
                  value={weights.companyWeight}
                  onChange={e => handleWeightChange('companyWeight', parseInt(e.target.value, 10))}
                  className="w-full accent-cyan-600 cursor-pointer"
                />
              </div>

              {/* 6. Barcode Weight */}
              <div>
                <div className="flex justify-between font-bold text-slate-700 mb-1">
                  <span className="flex items-center space-x-1.5 space-x-reverse">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-700 inline-block"></span>
                    <span>وزن الباركود (عند توفره):</span>
                  </span>
                  <span className="font-mono text-slate-800">{weights.barcodeWeight}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={50}
                  step={5}
                  value={weights.barcodeWeight}
                  onChange={e => handleWeightChange('barcodeWeight', parseInt(e.target.value, 10))}
                  className="w-full accent-slate-800 cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>تأثير ديناميكي فوري</span>
            <button
              onClick={handleResetWeights}
              className="text-emerald-700 hover:underline font-bold cursor-pointer"
            >
              استعادة الأوزان الافتراضية
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* GEMINI AI MATCH RESULT CARD (If analyzed) */}
      {/* ============================================================ */}
      {aiAnalysis && (
        <div className="bg-gradient-to-br from-purple-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-purple-500/40 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-800/80 pb-4">
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="p-2.5 bg-purple-500/30 text-purple-300 rounded-xl border border-purple-400/40">
                <Sparkles className="w-6 h-6 text-purple-300" />
              </div>
              <div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <h3 className="text-base font-bold text-white">
                    نتيجة فحص الذكاء الاصطناعي السريري (Gemini 3.8 Flash)
                  </h3>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-bold font-mono ${
                      aiAnalysis.decision === 'MATCHED'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : aiAnalysis.decision === 'REVIEW_REQUIRED'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-red-500/20 text-red-300 border border-red-500/40'
                    }`}
                  >
                    {aiAnalysis.decision === 'MATCHED'
                      ? '✓ مطابقة مؤكدة طبياً'
                      : aiAnalysis.decision === 'REVIEW_REQUIRED'
                      ? '⚠ يلزم تدقيق الصيدلي'
                      : '✗ غير مطابق'}
                  </span>
                </div>
                <p className="text-xs text-purple-200/80 mt-0.5">
                  تم استدعاء نموذج Gemini 3.8 Flash مع تطبيق قواعد السلامة الدوائية المعتمدة
                </p>
              </div>
            </div>

            <div className="text-left bg-purple-950/60 px-4 py-2 rounded-xl border border-purple-800/50 self-start sm:self-auto">
              <span className="text-[11px] text-purple-300 block">درجة ثقة الذكاء الاصطناعي:</span>
              <span className="text-2xl font-black font-mono text-purple-300">
                {aiAnalysis.confidenceScore}%
              </span>
            </div>
          </div>

          {/* Clinical Rationale */}
          <div className="bg-purple-950/40 p-4 rounded-xl border border-purple-800/50">
            <span className="text-xs font-bold text-purple-300 block mb-1">التعليل الصيدلاني والطبي:</span>
            <p className="text-xs text-purple-100 leading-relaxed">{aiAnalysis.clinicalRationale}</p>
          </div>

          {/* Key Extracted Medical Attributes */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-purple-950/50 p-2.5 rounded-xl border border-purple-800/40">
              <span className="text-[10px] text-purple-400 block font-medium">المادة الفعالة المكتشفة:</span>
              <span className="font-bold text-purple-200 mt-0.5 block truncate">
                {aiAnalysis.detectedActiveIngredient || '—'}
              </span>
            </div>
            <div className="bg-purple-950/50 p-2.5 rounded-xl border border-purple-800/40">
              <span className="text-[10px] text-purple-400 block font-medium">التركيز المعتمد:</span>
              <span className="font-bold text-purple-200 mt-0.5 block">
                {aiAnalysis.strengthConfirmed || '—'}
              </span>
            </div>
            <div className="bg-purple-950/50 p-2.5 rounded-xl border border-purple-800/40">
              <span className="text-[10px] text-purple-400 block font-medium">الشكل الدوائي:</span>
              <span className="font-bold text-purple-200 mt-0.5 block">
                {aiAnalysis.dosageFormConfirmed || '—'}
              </span>
            </div>
            <div className="bg-purple-950/50 p-2.5 rounded-xl border border-purple-800/40">
              <span className="text-[10px] text-purple-400 block font-medium">تقييم الأمان السريري:</span>
              <span
                className={`font-bold mt-0.5 block ${
                  aiAnalysis.safetyRiskLevel === 'SAFE'
                    ? 'text-emerald-400'
                    : aiAnalysis.safetyRiskLevel === 'WARNING'
                    ? 'text-amber-400'
                    : 'text-red-400'
                }`}
              >
                {aiAnalysis.safetyRiskLevel === 'SAFE'
                  ? '✓ آمن ومطابق'
                  : aiAnalysis.safetyRiskLevel === 'WARNING'
                  ? '⚠ تحذير طفيف'
                  : '🚨 تعارض جرعات خطير'}
              </span>
            </div>
          </div>

          {/* AI Agreements & Differences */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
            <div className="bg-emerald-950/30 p-3 rounded-xl border border-emerald-700/40">
              <span className="font-bold text-emerald-300 block mb-1 text-[11px]">
                أوجه الاتفاق التي رصدها الذكاء الاصطناعي:
              </span>
              <ul className="space-y-1 text-emerald-200 text-[11px]">
                {aiAnalysis.agreementPoints.map((pt, i) => (
                  <li key={i}>✓ {pt}</li>
                ))}
              </ul>
            </div>
            <div className="bg-amber-950/30 p-3 rounded-xl border border-amber-700/40">
              <span className="font-bold text-amber-300 block mb-1 text-[11px]">
                أوجه الاختلاف والتحفظات:
              </span>
              <ul className="space-y-1 text-amber-200 text-[11px]">
                {aiAnalysis.differencePoints.map((pt, i) => (
                  <li key={i}>• {pt}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. DETAILED SCORE BREAKDOWN & CLINICAL ANALYSIS */}
      {/* ============================================================ */}
      {inspectedCandidate && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Header of Score Breakdown */}
          <div className="p-6 bg-gradient-to-r from-slate-50 via-white to-slate-50 border-b border-slate-200">
            {matchResult?.isPriceFallbackMatch && (
              <div className="mb-4 bg-gradient-to-r from-cyan-50 to-blue-50 border-2 border-cyan-400 p-4 rounded-2xl flex items-start space-x-3 space-x-reverse text-xs shadow-xs">
                <div className="w-8 h-8 rounded-xl bg-cyan-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4 text-cyan-100" />
                </div>
                <div>
                  <div className="font-black text-cyan-950 text-sm">
                    ✨ تم التفعيل: خط الدفاع الأخير بالسعر والكمية (MedicalInvoiceMatcher - Price Fallback)
                  </div>
                  <p className="text-cyan-900 mt-1 leading-relaxed">
                    الاسم في الفاتورة مختلف ولكن تم كشف تطابق السعر (<b>{matchResult.priceMatchStatus || 'ضمن 5%'}</b>) مع تطابق الكمية. تم احتساب النقاط الموزونة (الاسم 50% + السعر 30% + الكمية 20%) ورفع درجة الثقة تلقائياً إلى <b>{matchResult.confidenceScore}%</b> للمراجعة الفورية.
                  </p>
                </div>
              </div>
            )}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2 space-x-reverse mb-1.5">
                  <span
                    className={`text-xs px-3 py-1 rounded-full font-bold font-mono ${
                      inspectedCandidate.score >= 85 && inspectedCandidate.hardRulePassed
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : inspectedCandidate.score >= 50
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-red-100 text-red-800 border border-red-300'
                    }`}
                  >
                    {inspectedCandidate.score >= 85 && inspectedCandidate.hardRulePassed
                      ? '✓ مطابقة مؤكدة (MATCHED)'
                      : inspectedCandidate.score >= 50
                      ? '⚠ يحتاج مراجعة (REVIEW REQUIRED)'
                      : '✗ غير مطابق (UNMATCHED)'}
                  </span>
                  <span className="text-xs text-slate-500">
                    مقارنة مع الصنف الرسمي رقم:{' '}
                    <strong className="text-slate-800 font-mono">
                      {inspectedCandidate.masterItem.id}
                    </strong>
                  </span>
                </div>

                <div className="text-xl font-black text-slate-900 flex items-center space-x-2 space-x-reverse">
                  <span>{inspectedCandidate.masterItem.name}</span>
                  {inspectedCandidate.masterItem.nameAr && (
                    <span className="text-sm font-semibold text-slate-500">
                      ({inspectedCandidate.masterItem.nameAr})
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-slate-600 mt-2 font-mono">
                  <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    الباركود: {inspectedCandidate.masterItem.barcode}
                  </span>
                  <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    السعر الرسمي: {inspectedCandidate.masterItem.price} {currency}
                  </span>
                  {inspectedCandidate.masterItem.strength && (
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 font-medium">
                      التركيز: {inspectedCandidate.masterItem.strength}
                    </span>
                  )}
                  {inspectedCandidate.masterItem.dosageForm && (
                    <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200 font-medium">
                      الشكل: {inspectedCandidate.masterItem.dosageForm}
                    </span>
                  )}
                  {inspectedCandidate.masterItem.company && (
                    <span className="bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded border border-cyan-200 font-medium">
                      الشركة: {inspectedCandidate.masterItem.company}
                    </span>
                  )}
                </div>
              </div>

              {/* Total Score Gauge */}
              <div className="flex items-center space-x-4 space-x-reverse bg-white p-4 rounded-xl border border-slate-200 shadow-xs self-start lg:self-auto">
                <div className="text-center">
                  <div className="text-xs font-semibold text-slate-500 mb-0.5">
                    الدرجة الإجمالية المركبة
                  </div>
                  <div
                    className={`text-3xl font-black font-mono ${
                      inspectedCandidate.score >= 85 && inspectedCandidate.hardRulePassed
                        ? 'text-emerald-600'
                        : inspectedCandidate.score >= 50
                        ? 'text-amber-600'
                        : 'text-red-600'
                    }`}
                  >
                    {inspectedCandidate.score}%
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    مستوى الثقة: {inspectedCandidate.confidenceLevel}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Hard Clinical Safety Invariant Alert */}
          {!inspectedCandidate.hardRulePassed && (
            <div className="bg-red-500 text-white p-4 flex items-start space-x-3 space-x-reverse">
              <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm">
                  🚨 تحذير سريري صارم: تم تفعيل الحظر السريري وخفض النتيجة قسراً!
                </div>
                <div className="text-xs text-red-100 mt-0.5">
                  يوجد تعارض دوائي حرج: {inspectedCandidate.hardRuleViolations.join(' | ')}. يمنع
                  المحرك المطابقة التلقائية لمنع أي خلط محتمل بين الجرعات والأشكال الدوائية.
                </div>
              </div>
            </div>
          )}

          {/* Score Breakdown Table & Bars */}
          <div className="p-6 space-y-6">
            <div>
              <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center space-x-2 space-x-reverse">
                <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
                <span>تفصيل درجات العناصر (Score Breakdown & Component Contributions):</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Core Name */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5 space-x-reverse">
                      <Pill className="w-3.5 h-3.5 text-emerald-600" />
                      <span>1. الاسم التجاري والأساسي (Trade Name):</span>
                    </span>
                    <span className="text-xs font-bold font-mono text-emerald-700">
                      {inspectedCandidate.scoreBreakdown.coreNameScore}% (الوزن:{' '}
                      {weights.coreNameWeight}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden mb-2">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${inspectedCandidate.scoreBreakdown.coreNameScore}%` }}
                    ></div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    مقارنة: "{supplierEntity.coreName}" مقابل "
                    {inspectedCandidate.parsedEntity?.coreName || inspectedCandidate.masterItem.name}"
                  </p>
                </div>

                {/* 2. Strength */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5 space-x-reverse">
                      <Scale className="w-3.5 h-3.5 text-blue-600" />
                      <span>2. التركيز والجرعة (Strength / Dose):</span>
                    </span>
                    <span className="text-xs font-bold font-mono text-blue-700">
                      {inspectedCandidate.scoreBreakdown.strengthScore}% (الوزن:{' '}
                      {weights.strengthWeight}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden mb-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        inspectedCandidate.scoreBreakdown.strengthScore === 0
                          ? 'bg-red-500'
                          : 'bg-blue-500'
                      }`}
                      style={{ width: `${inspectedCandidate.scoreBreakdown.strengthScore}%` }}
                    ></div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    مقارنة: "{supplierEntity.strengthRaw || 'غير محدد'}" مقابل "
                    {inspectedCandidate.masterItem.strength || 'غير محدد'}"
                  </p>
                </div>

                {/* 3. Dosage Form */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5 space-x-reverse">
                      <Pill className="w-3.5 h-3.5 text-purple-600" />
                      <span>3. الشكل الدوائي (Dosage Form):</span>
                    </span>
                    <span className="text-xs font-bold font-mono text-purple-700">
                      {inspectedCandidate.scoreBreakdown.formScore}% (الوزن: {weights.formWeight}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden mb-2">
                    <div
                      className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${inspectedCandidate.scoreBreakdown.formScore}%` }}
                    ></div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    مقارنة: "{supplierEntity.dosageFormLabel || supplierEntity.dosageForm || 'غير محدد'}"
                    مقابل "{inspectedCandidate.masterItem.dosageForm || 'غير محدد'}"
                  </p>
                </div>

                {/* 4. Pack Size */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5 space-x-reverse">
                      <Package className="w-3.5 h-3.5 text-amber-600" />
                      <span>4. حجم العبوة (Pack Size):</span>
                    </span>
                    <span className="text-xs font-bold font-mono text-amber-700">
                      {inspectedCandidate.scoreBreakdown.packScore}% (الوزن: {weights.packWeight}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden mb-2">
                    <div
                      className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${inspectedCandidate.scoreBreakdown.packScore}%` }}
                    ></div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    مقارنة: "{supplierEntity.packRaw || 'غير محدد'}" مقابل "
                    {inspectedCandidate.masterItem.packSize || 'غير محدد'}"
                  </p>
                </div>

                {/* 5. Company */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5 space-x-reverse">
                      <Building2 className="w-3.5 h-3.5 text-cyan-600" />
                      <span>5. الشركة المصنعة / الموزع (Manufacturer):</span>
                    </span>
                    <span className="text-xs font-bold font-mono text-cyan-700">
                      {inspectedCandidate.scoreBreakdown.companyScore}% (الوزن:{' '}
                      {weights.companyWeight}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden mb-2">
                    <div
                      className="bg-cyan-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${inspectedCandidate.scoreBreakdown.companyScore}%` }}
                    ></div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    مقارنة: "{supplierEntity.company || 'غير محدد'}" مقابل "
                    {inspectedCandidate.masterItem.company || 'غير محدد'}"
                  </p>
                </div>

                {/* 6. Barcode */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5 space-x-reverse">
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-700" />
                      <span>6. الباركود الرسمي (Official Barcode):</span>
                    </span>
                    <span className="text-xs font-bold font-mono text-slate-800">
                      {inspectedCandidate.scoreBreakdown.barcodeScore}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden mb-2">
                    <div
                      className="bg-slate-700 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${inspectedCandidate.scoreBreakdown.barcodeScore}%` }}
                    ></div>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {supplierBarcode
                      ? `مدخل: ${supplierBarcode} vs نظام: ${inspectedCandidate.masterItem.barcode}`
                      : 'لم يتم إدخال باركود في الفاتورة لهذا الفحص'}
                  </p>
                </div>
              </div>
            </div>

            {/* Agreement & Difference Points */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
              {/* Agreements */}
              <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200">
                <div className="text-xs font-bold text-emerald-900 mb-2 flex items-center space-x-1.5 space-x-reverse">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>نقاط الاتفاق والمطابقة (Agreement Points):</span>
                </div>
                {inspectedCandidate.agreementPoints.length > 0 ? (
                  <ul className="space-y-1.5 text-xs text-emerald-800">
                    {inspectedCandidate.agreementPoints.map((pt, i) => (
                      <li key={i} className="flex items-start space-x-1.5 space-x-reverse">
                        <span className="text-emerald-600 font-bold ml-1">✓</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-xs text-slate-500">لا توجد نقاط اتفاق قوية مسجلة.</div>
                )}
              </div>

              {/* Differences */}
              <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200">
                <div className="text-xs font-bold text-amber-900 mb-2 flex items-center space-x-1.5 space-x-reverse">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>نقاط الاختلاف والتحذير (Difference Points):</span>
                </div>
                {inspectedCandidate.differencePoints.length > 0 ? (
                  <ul className="space-y-1.5 text-xs text-amber-800">
                    {inspectedCandidate.differencePoints.map((pt, i) => (
                      <li key={i} className="flex items-start space-x-1.5 space-x-reverse">
                        <span className="text-amber-600 font-bold ml-1">•</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-xs text-emerald-700 font-medium">
                    تطابق ممتاز بدون أي اختلافات جوهرية مسجلة!
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 5. CANDIDATE LIST & MANUAL 1-ON-1 COMPARISON */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Matching Candidates */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2 space-x-reverse">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>المرشحون المقترحون من قاعدة البيانات ({matchResult?.candidates.length || 0}):</span>
            </h3>
            <span className="text-[11px] text-slate-400">انقر على أي مرشح لفحص تفاصيل درجته</span>
          </div>

          {matchResult?.candidates && matchResult.candidates.length > 0 ? (
            <div className="space-y-2.5">
              {matchResult.candidates.map((cand, idx) => {
                const isSelected =
                  !selectedManualMaster &&
                  (inspectedCandidate?.masterItem.id === cand.masterItem.id ||
                    selectedCandidateIndex === idx);

                return (
                  <div
                    key={cand.masterItem.id}
                    onClick={() => {
                      setSelectedManualMaster(null);
                      setSelectedCandidateIndex(idx);
                    }}
                    className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-emerald-50/80 border-emerald-500 shadow-xs'
                        : 'bg-slate-50/60 border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-slate-900 text-xs truncate block">
                          {cand.masterItem.name}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap gap-2 font-mono">
                        <span>{cand.masterItem.strength || 'بدون تركيز'}</span>
                        <span>•</span>
                        <span>{cand.masterItem.dosageForm || 'بدون شكل'}</span>
                        <span>•</span>
                        <span>{cand.masterItem.price} {currency}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 space-x-reverse">
                      <span
                        className={`text-sm font-black font-mono px-2.5 py-1 rounded-lg ${
                          cand.score >= 85 && cand.hardRulePassed
                            ? 'bg-emerald-100 text-emerald-800'
                            : cand.score >= 50
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {cand.score}%
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-xs text-slate-400">
              لم يتم العثور على مرشحين للصنف المدخل.
            </div>
          )}
        </div>

        {/* 1-on-1 Manual Database Comparison Search */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2 space-x-reverse">
              <Search className="w-4 h-4 text-emerald-600" />
              <span>مقارنة مباشرة (1-to-1) مع أي صنف في الصيدلية:</span>
            </h3>
            {selectedManualMaster && (
              <button
                onClick={() => setSelectedManualMaster(null)}
                className="text-xs text-emerald-700 font-bold hover:underline cursor-pointer"
              >
                العودة للمرشحين
              </button>
            )}
          </div>

          <div className="mb-3">
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              ابحث عن أي صنف في قاعدة البيانات الرسمية للمقارنة المباشرة معه:
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={manualMasterSearch}
                onChange={e => setManualMasterSearch(e.target.value)}
                placeholder="ابحث بالاسم العربي، الإنجليزي، أو الباركود..."
                className="w-full pr-9 pl-3 py-2 text-xs border border-slate-300 rounded-xl bg-slate-50 focus:bg-white"
              />
            </div>
          </div>

          {searchResultsMaster.length > 0 && (
            <div className="space-y-1.5 mb-3 border border-slate-200 rounded-xl p-2 bg-slate-50/50 max-h-48 overflow-y-auto">
              <span className="text-[10px] text-slate-400 font-bold block mb-1">
                اختر صنفاً لبدء المقارنة الفورية معه:
              </span>
              {searchResultsMaster.map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelectedManualMaster(item);
                    setManualMasterSearch('');
                  }}
                  className="w-full text-right p-2 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 text-xs transition cursor-pointer flex justify-between items-center"
                >
                  <div>
                    <div className="font-bold text-slate-800">{item.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      تركيز: {item.strength || '—'} | شكل: {item.dosageForm || '—'} | باركود:{' '}
                      {item.barcode}
                    </div>
                  </div>
                  <span className="text-emerald-700 font-bold text-xs bg-emerald-50 px-2 py-1 rounded">
                    مقارنة
                  </span>
                </button>
              ))}
            </div>
          )}

          {selectedManualMaster ? (
            <div className="bg-emerald-50/70 border border-emerald-300 p-4 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-900 bg-emerald-200/60 px-2.5 py-0.5 rounded">
                  جاري فحص المقارنة المباشرة مع:
                </span>
                <span className="text-xs font-bold text-emerald-800 font-mono">
                  {selectedManualMaster.id}
                </span>
              </div>
              <div className="font-bold text-slate-900 text-sm">{selectedManualMaster.name}</div>
              <div className="text-xs text-slate-600 mt-1 font-mono">
                باركود: {selectedManualMaster.barcode} | السعر: {selectedManualMaster.price}{' '}
                {currency}
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                تم تحديث لوحة التحليل ودرجات المطابقة في الأعلى لتعرض درجات هذا الصنف حصرياً.
              </p>
            </div>
          ) : (
            <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
              ابحث عن أي صنف بالاسم أو الباركود لمقارنته مباشرة مع سطر الفاتورة المدخل.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
