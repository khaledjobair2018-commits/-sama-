import React, { useState, useMemo, useRef } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  X,
  Search,
  ChevronRight,
  ChevronLeft,
  BookmarkPlus,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Pill,
  Scale,
  Building2,
  Package,
  Layers,
  HelpCircle,
  CheckCircle2,
  SlidersHorizontal,
  Info,
  Edit3,
  Check,
  Bot,
  PlusCircle,
} from 'lucide-react';
import { CandidateItem, MasterItem, MatchResult } from '../types/pharmacy';
import { extractPharmaEntity, compareStrengths } from '../services/extractor';
import { normalizeText } from '../services/normalizer';
import { aiMatchService, CandidateAIExplanation } from '../services/aiMatcher';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  reviewResults: MatchResult[];
  allMasterItems: MasterItem[];
  onConfirmMatch: (rowNumber: number, chosenMasterItem: MasterItem, saveToDictionary: boolean) => void;
  onMarkUnmatched: (rowNumber: number) => void;
  onAddNewProduct?: (newProduct: Partial<MasterItem>, rowNumber: number) => void;
  currency: string;
}

interface DetailedReasoning {
  matchingTokens: string[];
  unmatchedSupplierTokens: string[];
  activeIngredientMatch: {
    status: 'MATCHED' | 'COMPATIBLE' | 'ABSENT_IN_QUERY' | 'NOT_SPECIFIED';
    text: string;
    details: string;
  };
  strengthAnalysis: {
    status: 'EXACT' | 'EQUIVALENT' | 'MISMATCH' | 'NOT_SPECIFIED';
    text: string;
  };
  formAnalysis: {
    status: 'EXACT' | 'MISMATCH' | 'NOT_SPECIFIED';
    text: string;
  };
  packAnalysis: {
    status: 'EXACT' | 'MISMATCH' | 'NOT_SPECIFIED';
    text: string;
  };
  companyAnalysis: {
    status: 'EXACT' | 'ALIAS' | 'MISMATCH' | 'NOT_SPECIFIED';
    text: string;
  };
  whySelected: string;
  whyNeedsReview: string;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  isOpen,
  onClose,
  reviewResults,
  allMasterItems,
  onConfirmMatch,
  onMarkUnmatched,
  onAddNewProduct,
  currency,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saveToDict, setSaveToDict] = useState(true);
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [activeCandidateIndex, setActiveCandidateIndex] = useState(0);
  const [aiExplanation, setAiExplanation] = useState<CandidateAIExplanation | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdBarcode, setNewProdBarcode] = useState('');
  const [newProdForm, setNewProdForm] = useState('اقراص');
  const [newProdPrice, setNewProdPrice] = useState<number>(0);
  const [newProdStrength, setNewProdStrength] = useState('');
  const manualSearchInputRef = useRef<HTMLInputElement>(null);

  const currentResult = (reviewResults && reviewResults[currentIndex]) || (reviewResults && reviewResults[0]);
  const rawSupplierName = currentResult?.invoiceLine?.rawSupplierName || '';

  // Parse supplier raw entity (Hook must always be called unconditionally)
  const supplierEntity = useMemo(() => {
    return rawSupplierName ? extractPharmaEntity(rawSupplierName) : extractPharmaEntity('');
  }, [rawSupplierName]);

  if (!isOpen || !reviewResults || reviewResults.length === 0 || !currentResult) return null;

  const totalToReview = reviewResults.length;

  const handleNext = () => {
    if (currentIndex < totalToReview - 1) {
      setCurrentIndex(currentIndex + 1);
      setManualSearchQuery('');
      setActiveCandidateIndex(0);
      setAiExplanation(null);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setManualSearchQuery('');
      setActiveCandidateIndex(0);
      setAiExplanation(null);
    }
  };

  const handleRequestAiConsultation = async (master: MasterItem) => {
    setIsLoadingAi(true);
    try {
      const res = await aiMatchService.explainCandidate(
        currentResult.invoiceLine.rawSupplierName,
        master
      );
      setAiExplanation(res);
    } finally {
      setIsLoadingAi(false);
    }
  };

  const handleAcceptCandidate = (candidate: CandidateItem) => {
    onConfirmMatch(currentResult.rowNumber, candidate.masterItem, saveToDict);
    if (currentIndex < totalToReview - 1) {
      setCurrentIndex(currentIndex + 1);
      setActiveCandidateIndex(0);
    } else {
      onClose();
    }
    setManualSearchQuery('');
  };

  const handleAcceptManual = (item: MasterItem) => {
    onConfirmMatch(currentResult.rowNumber, item, saveToDict);
    if (currentIndex < totalToReview - 1) {
      setCurrentIndex(currentIndex + 1);
      setActiveCandidateIndex(0);
    } else {
      onClose();
    }
    setManualSearchQuery('');
  };

  const handleTriggerManualSearch = (term?: string) => {
    const query = term || currentResult.invoiceLine.rawSupplierName;
    setManualSearchQuery(query);
    setTimeout(() => {
      manualSearchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      manualSearchInputRef.current?.focus();
    }, 100);
  };

  const handleMarkUnmatched = () => {
    onMarkUnmatched(currentResult.rowNumber);
    if (currentIndex < totalToReview - 1) {
      setCurrentIndex(currentIndex + 1);
      setActiveCandidateIndex(0);
    } else {
      onClose();
    }
    setManualSearchQuery('');
  };

  const handleOpenAddProductDialog = () => {
    setNewProdName(currentResult.invoiceLine.rawSupplierName || '');
    setNewProdBarcode(currentResult.invoiceLine.supplierBarcode || `628${Date.now().toString().slice(-9)}`);
    setNewProdPrice(currentResult.invoiceLine.unitPrice || 0);
    setNewProdStrength(supplierEntity.strengthRaw || '');
    setNewProdForm(supplierEntity.dosageFormLabel || 'اقراص');
    setIsAddProductOpen(true);
  };

  const handleSaveAndConfirmNewProduct = () => {
    if (!newProdName.trim()) return;
    const finalBarcode = newProdBarcode.trim() || `628${Date.now().toString().slice(-9)}`;
    const newMaster: Partial<MasterItem> = {
      name: newProdName.trim(),
      nameAr: newProdName.trim(),
      barcode: finalBarcode,
      price: newProdPrice > 0 ? newProdPrice : 0,
      dosageForm: newProdForm,
      strength: newProdStrength.trim() || undefined,
    };

    if (onAddNewProduct) {
      onAddNewProduct(newMaster, currentResult.rowNumber);
    }

    setIsAddProductOpen(false);
    if (currentIndex < totalToReview - 1) {
      setCurrentIndex(currentIndex + 1);
      setActiveCandidateIndex(0);
    } else {
      onClose();
    }
  };

  // Filter master items for live manual search
  const filteredManualItems = manualSearchQuery.trim()
    ? allMasterItems.filter(
        item =>
          item.name.toLowerCase().includes(manualSearchQuery.toLowerCase()) ||
          (item.nameAr && item.nameAr.includes(manualSearchQuery)) ||
          item.barcode.includes(manualSearchQuery) ||
          (item.activeIngredient && item.activeIngredient.toLowerCase().includes(manualSearchQuery.toLowerCase()))
      ).slice(0, 10)
    : [];

  // Compute detailed reasoning for each candidate based on Tokens, Strength, and Active Ingredient
  const computeDetailedReasoning = (cand: CandidateItem): DetailedReasoning => {
    const master = cand.masterItem;
    const masterEntity = extractPharmaEntity(
      `${master.name} ${master.nameAr || ''} ${master.dosageForm || ''} ${master.strength || ''} ${master.company || ''}`
    );

    // 1. Token Analysis (Exact & Root overlap)
    const supplierTokens = supplierEntity.coreTokens;
    const masterFullText = normalizeText(
      `${master.name} ${master.nameAr || ''} ${master.dosageForm || ''} ${master.strength || ''} ${master.company || ''} ${master.activeIngredient || ''}`
    );
    const masterTokensSet = new Set(masterEntity.coreTokens);

    const matchingTokens: string[] = [];
    const unmatchedSupplierTokens: string[] = [];

    supplierTokens.forEach(tok => {
      if (masterTokensSet.has(tok) || masterFullText.includes(tok)) {
        matchingTokens.push(tok);
      } else {
        unmatchedSupplierTokens.push(tok);
      }
    });

    // 2. Active Ingredient Analysis
    let activeIngredientMatch: DetailedReasoning['activeIngredientMatch'] = {
      status: 'NOT_SPECIFIED',
      text: 'غير مسجلة في كرت الصنف بالنظام',
      details: 'لا توجد مادة فعالة مسجلة صراحة للصنف في النظام الرسمي.',
    };

    if (master.activeIngredient) {
      const activeNorm = normalizeText(master.activeIngredient).toLowerCase();
      const supNorm = normalizeText(currentResult.invoiceLine.rawSupplierName).toLowerCase();

      const activeParts = activeNorm.split(/[\+\,\s]+/).filter(p => p.length > 2);
      const matchedParts = activeParts.filter(p => supNorm.includes(p));

      if (matchedParts.length > 0) {
        activeIngredientMatch = {
          status: 'MATCHED',
          text: `مطابقة مباشرة: ${master.activeIngredient}`,
          details: `تم العثور على المادة الفعالة (${matchedParts.join(', ')}) مذكورة صراحة في اسم الفاتورة.`,
        };
      } else {
        activeIngredientMatch = {
          status: 'COMPATIBLE',
          text: `المادة الفعالة الرسمية: ${master.activeIngredient}`,
          details: `الصنف الرسمي ينتمي للتركيبة (${master.activeIngredient}) المتوافقة طبياً مع هذا الدواء.`,
        };
      }
    }

    // 3. Strength Analysis
    let strengthAnalysis: DetailedReasoning['strengthAnalysis'] = {
      status: 'NOT_SPECIFIED',
      text: 'التركيز غير محدد في أحد الطرفين',
    };

    const strComp = compareStrengths(supplierEntity, masterEntity);
    if (strComp.isMatch) {
      strengthAnalysis = {
        status: strComp.isEquivalent ? 'EQUIVALENT' : 'EXACT',
        text: strComp.details,
      };
    } else if (strComp.isConflict) {
      strengthAnalysis = {
        status: 'MISMATCH',
        text: `⚠️ ${strComp.details}`,
      };
    } else if (master.strength) {
      strengthAnalysis = {
        status: 'NOT_SPECIFIED',
        text: `التركيز بالنظام (${master.strength}) ولم يذكر صراحة في سطر الفاتورة`,
      };
    }

    // 4. Dosage Form Analysis
    let formAnalysis: DetailedReasoning['formAnalysis'] = {
      status: 'NOT_SPECIFIED',
      text: 'الشكل غير محدد في أحدهما',
    };
    if (supplierEntity.dosageForm && masterEntity.dosageForm) {
      if (supplierEntity.dosageForm === masterEntity.dosageForm) {
        formAnalysis = {
          status: 'EXACT',
          text: `تطابق تام في الشكل الدوائي (${supplierEntity.dosageFormLabel || supplierEntity.dosageForm})`,
        };
      } else {
        formAnalysis = {
          status: 'MISMATCH',
          text: `اختلاف الشكل: الفاتورة (${supplierEntity.dosageFormLabel || supplierEntity.dosageForm}) مقابل النظام (${master.dosageForm || masterEntity.dosageForm})`,
        };
      }
    } else if (master.dosageForm) {
      formAnalysis = {
        status: 'NOT_SPECIFIED',
        text: `الشكل الرسمي بالنظام: ${master.dosageForm}`,
      };
    }

    // 5. Pack Size Analysis
    let packAnalysis: DetailedReasoning['packAnalysis'] = {
      status: 'NOT_SPECIFIED',
      text: 'العبوة غير محددة',
    };
    if (supplierEntity.packCount && masterEntity.packCount) {
      if (supplierEntity.packCount === masterEntity.packCount) {
        packAnalysis = {
          status: 'EXACT',
          text: `تطابق العبوة بالكامل (${supplierEntity.packRaw})`,
        };
      } else {
        packAnalysis = {
          status: 'MISMATCH',
          text: `اختلاف العبوة: الفاتورة (${supplierEntity.packRaw}) مقابل النظام (${master.packSize || masterEntity.packRaw})`,
        };
      }
    } else if (master.packSize) {
      packAnalysis = {
        status: 'NOT_SPECIFIED',
        text: `العبوة الرسمية بالنظام: ${master.packSize}`,
      };
    }

    // 6. Company Analysis
    let companyAnalysis: DetailedReasoning['companyAnalysis'] = {
      status: 'NOT_SPECIFIED',
      text: 'الشركة غير محددة',
    };
    if (supplierEntity.company && master.company) {
      if (normalizeText(supplierEntity.company) === normalizeText(master.company)) {
        companyAnalysis = {
          status: 'EXACT',
          text: `تطابق الشركة المصنعة: ${master.company}`,
        };
      } else {
        companyAnalysis = {
          status: 'MISMATCH',
          text: `شركة مختلفة: الفاتورة (${supplierEntity.company}) مقابل النظام (${master.company})`,
        };
      }
    } else if (master.company) {
      companyAnalysis = {
        status: 'NOT_SPECIFIED',
        text: `الشركة بالنظام: ${master.company}`,
      };
    }

    // Why selected vs why needs review
    const whySelected =
      cand.agreementPoints.length > 0
        ? cand.agreementPoints.join('، ')
        : 'تشابه الاسم التجاري ونسبة عالية من المفردات المشتركة';

    let whyNeedsReview = 'مراجعة وتأكيد الصيدلي للاعتماد النهائي.';
    if (!cand.hardRulePassed) {
      whyNeedsReview = `تحذير سريري صارم: ${cand.hardRuleViolations.join(' | ')}. يمنع النظام المطابقة التلقائية لتفادي خلط الجرعات.`;
    } else if (cand.score < 85) {
      whyNeedsReview = `نسبة الثقة (${cand.score}%) تتطلب تدقيق الصيدلي لوجود اختلافات في (الشكل، العبوة، أو اسم الموزع).`;
    } else if (currentResult.candidates.length > 1 && Math.abs(cand.score - (currentResult.candidates[1]?.score || 0)) < 5) {
      whyNeedsReview = `تقارب شديد بين الخيار الأول والخيار الثاني، مما يستلزم اختيار الصيدلي للصنف الفعلي المطلوب.`;
    }

    return {
      matchingTokens,
      unmatchedSupplierTokens,
      activeIngredientMatch,
      strengthAnalysis,
      formAnalysis,
      packAnalysis,
      companyAnalysis,
      whySelected,
      whyNeedsReview,
    };
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full overflow-hidden flex flex-col max-h-[95vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <h2 className="text-base font-bold text-white">
                  شاشة المراجعة الصيدلانية ومحرك التفسير (Reasoning Engine)
                </h2>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-mono">
                  Clinical Inspector
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                فحص السطر {currentIndex + 1} من إجمالي {totalToReview} سطر يحتاج مراجعة وتأكيد الصيدلي
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* 1. Supplier Raw Line Card with Entity Chips */}
          <div className="bg-gradient-to-br from-amber-50/90 to-amber-50/40 border border-amber-200 rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-amber-900 bg-amber-200/70 px-3 py-1 rounded-lg self-start">
                سطر فاتورة المورد الأصلي (الصف رقم {currentResult.rowNumber})
              </span>
              {currentResult.reviewReason && (
                <span className="text-xs font-semibold text-amber-800 flex items-center bg-amber-100/60 px-2.5 py-1 rounded-lg">
                  <ShieldAlert className="w-4 h-4 ml-1.5 text-amber-600 flex-shrink-0" />
                  {currentResult.reviewReason}
                </span>
              )}
            </div>

            <div className="text-xl font-black text-slate-900 my-2">
              {currentResult.invoiceLine.rawSupplierName}
            </div>

            {/* Extracted Supplier Tokens Pill Bar */}
            <div className="bg-white/80 p-3 rounded-xl border border-amber-200/80 mb-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500 font-bold flex items-center space-x-1 space-x-reverse ml-1">
                <Layers className="w-3.5 h-3.5 text-amber-600" />
                <span>المفردات المستخرجة من الفاتورة (Tokens):</span>
              </span>
              {supplierEntity.coreTokens.map((tok, i) => (
                <span
                  key={i}
                  className="bg-amber-100/80 text-amber-900 font-mono font-bold px-2 py-0.5 rounded-md border border-amber-200"
                >
                  {tok}
                </span>
              ))}
            </div>

            {/* Numeric & Commercial Info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white/90 p-2.5 rounded-xl border border-amber-100">
                <span className="text-slate-500 block text-[11px]">الكمية بالفاتورة:</span>
                <span className="font-bold text-slate-900 text-sm font-mono">
                  {currentResult.invoiceLine.quantity}
                </span>
              </div>
              <div className="bg-white/90 p-2.5 rounded-xl border border-amber-100">
                <span className="text-slate-500 block text-[11px]">سعر الوحدة من المورد:</span>
                <span className="font-bold text-slate-900 text-sm font-mono">
                  {currentResult.invoiceLine.unitPrice} {currency}
                </span>
              </div>
              <div className="bg-white/90 p-2.5 rounded-xl border border-amber-100">
                <span className="text-slate-500 block text-[11px]">باركود المورد:</span>
                <span className="font-bold font-mono text-slate-800 text-sm">
                  {currentResult.invoiceLine.supplierBarcode || 'غير مدخل بالسطر'}
                </span>
              </div>
              <div className="bg-white/90 p-2.5 rounded-xl border border-amber-100">
                <span className="text-slate-500 block text-[11px]">إجمالي تكلفة السطر:</span>
                <span className="font-bold text-slate-900 text-sm font-mono">
                  {currentResult.totalSupplierCost} {currency}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Candidate Selection Tabs (if multiple candidates) */}
          {currentResult.candidates.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5 space-x-reverse">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>المرشحون المقترحون من قاعدة الأصناف ({currentResult.candidates.length}):</span>
                </h3>
                <span className="text-xs text-slate-500">
                  انقر لاختيار المرشح وعرض التفسير الصيدلاني له
                </span>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {currentResult.candidates.map((cand, idx) => {
                  const isSelected = activeCandidateIndex === idx;
                  return (
                    <button
                      key={cand.masterItem.id}
                      onClick={() => setActiveCandidateIndex(idx)}
                      className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition flex items-center space-x-2 space-x-reverse whitespace-nowrap cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono ${
                          isSelected ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <span className="truncate max-w-[180px]">{cand.masterItem.name}</span>
                      <span
                        className={`font-mono px-1.5 py-0.5 rounded text-[10px] ${
                          cand.score >= 85 && cand.hardRulePassed
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {cand.score}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2.5 PRICE & QUANTITY FALLBACK BANNER */}
          {currentResult.isPriceFallbackMatch && (
            <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border-2 border-cyan-300 rounded-2xl p-4 flex items-start space-x-3 space-x-reverse shadow-xs">
              <div className="w-8 h-8 rounded-xl bg-cyan-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 text-cyan-100" />
              </div>
              <div className="text-xs">
                <div className="font-black text-cyan-950 text-sm flex items-center gap-2">
                  <span>✨ مطابق محتمل عبر خط الدفاع الأخير بالسعر والكمية (Price Fallback)</span>
                  <span className="bg-cyan-200 text-cyan-900 px-2 py-0.5 rounded-full text-[10px] font-mono">
                    ثقة: {currentResult.confidenceScore}%
                  </span>
                </div>
                <div className="text-cyan-900 mt-1 leading-relaxed">
                  الاسم النصي في الفاتورة مختلف، لكن تم كشف تطابق تام أو فارق بسيط في السعر (<b>{currentResult.priceMatchStatus || 'ضمن هامش 5%'}</b>) مع تطابق كمية الفاتورة (<b>{currentResult.invoiceLine.quantity}</b>). يرجى مراجعة الصنف وتأكيده سريعاً.
                </div>
              </div>
            </div>
          )}

          {/* 3. ACTIVE CANDIDATE CARD WITH EMBEDDED REASONING ENGINE */}
          {currentResult.candidates.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-500 text-xs">
              <p className="font-bold text-slate-700 mb-1">لم يتم إيجاد مرشحين تلقائيين لهذا السطر.</p>
              <p>استخدم محرك البحث اليدوي في الأسفل للبحث المباشر في قاعدة الأصناف الرسمية واختيار الصنف.</p>
              <button
                onClick={() => handleTriggerManualSearch()}
                className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center space-x-1.5 space-x-reverse cursor-pointer shadow-xs"
              >
                <Search className="w-4 h-4" />
                <span>فتح البحث اليدوي الآن</span>
              </button>
            </div>
          ) : (
            (() => {
              const cand = currentResult.candidates[activeCandidateIndex] || currentResult.candidates[0];
              const master = cand.masterItem;
              const priceDiff = currentResult.invoiceLine.unitPrice - master.price;
              const reasoning = computeDetailedReasoning(cand);

              return (
                <div className="bg-white rounded-2xl border-2 border-emerald-500/80 shadow-md overflow-hidden transition-all">
                  {/* Candidate Master Header Card */}
                  <div className="p-5 bg-gradient-to-r from-slate-50 via-white to-slate-50 border-b border-slate-200">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 space-x-reverse mb-1.5">
                          <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center font-mono">
                            {activeCandidateIndex + 1}
                          </span>
                          <span className="text-lg font-black text-slate-900">{master.name}</span>
                          {master.nameAr && (
                            <span className="text-sm font-semibold text-slate-500">({master.nameAr})</span>
                          )}
                          <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-300">
                            المرشح المعروض
                          </span>
                        </div>

                        {/* Attribute Badges */}
                        <div className="flex flex-wrap gap-2 text-xs text-slate-600 mt-2 font-mono">
                          <span className="bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                            باركود: {master.barcode}
                          </span>
                          {master.activeIngredient && (
                            <span className="bg-teal-50 text-teal-800 px-2.5 py-0.5 rounded border border-teal-200 font-bold font-sans">
                              المادة الفعالة: {master.activeIngredient}
                            </span>
                          )}
                          {master.strength && (
                            <span className="bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded border border-blue-200 font-medium">
                              التركيز: {master.strength}
                            </span>
                          )}
                          {master.dosageForm && (
                            <span className="bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded border border-purple-200 font-medium">
                              الشكل: {master.dosageForm}
                            </span>
                          )}
                          {master.packSize && (
                            <span className="bg-amber-50 text-amber-800 px-2.5 py-0.5 rounded border border-amber-200 font-medium">
                              العبوة: {master.packSize}
                            </span>
                          )}
                          {master.company && (
                            <span className="bg-cyan-50 text-cyan-800 px-2.5 py-0.5 rounded border border-cyan-200 font-medium font-sans">
                              الشركة: {master.company}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Score & Actions */}
                      <div className="flex items-center space-x-3 space-x-reverse self-end sm:self-auto flex-shrink-0">
                        <div className="text-left">
                          <div className="flex items-center space-x-1.5 space-x-reverse">
                            <span className="text-xs text-slate-500 font-medium">درجة التطابق:</span>
                            <span
                              className={`font-mono font-black text-lg ${
                                cand.score >= 85 && cand.hardRulePassed
                                  ? 'text-emerald-700'
                                  : cand.score >= 50
                                  ? 'text-amber-700'
                                  : 'text-red-700'
                              }`}
                            >
                              {cand.score}%
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 block font-mono">
                            سعر النظام: {master.price} {currency}
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            onClick={() => handleAcceptCandidate(cand)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 space-x-reverse shadow-xs cursor-pointer"
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span>اعتماد هذا الصنف</span>
                          </button>
                          <button
                            onClick={() => handleTriggerManualSearch(master.name)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1 space-x-reverse cursor-pointer border border-slate-300"
                            title="تعديل واختيار صنف بديل من قاعدة البيانات"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                            <span>تعديل يدوي</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Critical Hard Rule Alert */}
                    {!cand.hardRulePassed && (
                      <div className="mt-3 p-3 bg-red-100 border border-red-300 rounded-xl text-red-900 text-xs flex items-start space-x-2 space-x-reverse">
                        <ShieldAlert className="w-4 h-4 text-red-700 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">تحذير أمان سريري:</span> {cand.hardRuleViolations.join(' | ')}.
                          يحظر النظام المطابقة الآلية لتفادي خلط الجرعات والتركيزات.
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ============================================================ */}
                  {/* THE REASONING ENGINE PANEL (Always Visible & Crystal Clear) */}
                  {/* ============================================================ */}
                  <div className="p-5 space-y-4 bg-slate-50/50">
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <div className="p-1.5 bg-emerald-600 text-white rounded-lg">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900">
                          محرك التفسير والتعليل الصيدلاني (Reasoning Engine Analysis)
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          تحليل تفصيلي لمطابقة الـ Tokens، المادة الفعالة، التركيز، والأشكال الدوائية
                        </p>
                      </div>
                    </div>

                    {/* 1. WHY SELECTED & WHY REVIEW NEEDED BOX */}
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2 text-xs">
                      <div className="flex items-start space-x-2 space-x-reverse">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-slate-900 ml-1">لماذا اختار المحرك هذا المرشح؟</span>
                          <span className="text-slate-700">{reasoning.whySelected}</span>
                        </div>
                      </div>
                      <div className="flex items-start space-x-2 space-x-reverse">
                        <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-slate-900 ml-1">لماذا لم يُعتمد آلياً ويتطلب المراجعة؟</span>
                          <span className="text-slate-700">{reasoning.whyNeedsReview}</span>
                        </div>
                      </div>
                    </div>

                    {/* Gemini AI Clinical Consultation Card */}
                    <div className="bg-gradient-to-br from-purple-50 via-indigo-50/70 to-purple-50 p-4 rounded-xl border border-purple-200/90 shadow-2xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 pb-2 border-b border-purple-200/60">
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <div className="p-1 bg-purple-600 text-white rounded-md">
                            <Bot className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="text-xs font-black text-purple-950 block">
                              استشارة الذكاء الاصطناعي السريري (Gemini 3.8 Flash Second Opinion)
                            </span>
                            <span className="text-[10px] text-purple-700">
                              تدقيق ذكي للمادة الفعالة، الجرعة، والتكافؤ العلاجي
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleRequestAiConsultation(master)}
                          disabled={isLoadingAi}
                          className="bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition flex items-center space-x-1.5 space-x-reverse cursor-pointer shadow-xs disabled:opacity-50 self-start sm:self-auto"
                        >
                          <Sparkles className={`w-3.5 h-3.5 text-purple-200 ${isLoadingAi ? 'animate-spin' : ''}`} />
                          <span>
                            {isLoadingAi
                              ? 'جارِ التحليل الطبي...'
                              : aiExplanation
                              ? 'إعادة استشارة الذكاء الاصطناعي'
                              : 'طلب استشارة الذكاء الاصطناعي'}
                          </span>
                        </button>
                      </div>

                      {aiExplanation ? (
                        <div className="space-y-2 text-xs animate-fade-in">
                          <div className="bg-white/90 p-3 rounded-lg border border-purple-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-purple-900">الحكم الصيدلاني للذكاء الاصطناعي:</span>
                              <span className="bg-purple-100 text-purple-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded">
                                ثقة {aiExplanation.confidenceScore}%
                              </span>
                            </div>
                            <p className="text-slate-800 leading-relaxed">{aiExplanation.summaryVerdict}</p>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                            <div className="bg-white/80 p-2.5 rounded-lg border border-purple-100">
                              <span className="font-bold text-slate-700 block mb-0.5">تقييم الجرعة والتركيز:</span>
                              <span className="text-slate-600">{aiExplanation.dosageEvaluation}</span>
                            </div>
                            <div className="bg-white/80 p-2.5 rounded-lg border border-purple-100">
                              <span className="font-bold text-slate-700 block mb-0.5">توصية الصيدلي:</span>
                              <span className="text-purple-900 font-medium">{aiExplanation.clinicalAdvice}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-purple-800/80">
                          اضغط على "طلب استشارة الذكاء الاصطناعي" للحصول على تحليل سريري فوري من Gemini 3.8 Flash حول تطابق المادة والتركيز.
                        </p>
                      )}
                    </div>

                    {/* 2. AGREEMENT VS DIFFERENCE (SIDE-BY-SIDE CARDS) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Agreement Points Card */}
                      <div className="bg-emerald-50/80 p-4 rounded-xl border border-emerald-200 shadow-2xs">
                        <div className="text-xs font-bold text-emerald-950 mb-2.5 flex items-center space-x-1.5 space-x-reverse border-b border-emerald-200/80 pb-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span>قائمة أوجه الاتفاق والمطابقة (Agreement Points):</span>
                        </div>
                        <ul className="space-y-2 text-xs text-emerald-900">
                          {cand.agreementPoints.length > 0 ? (
                            cand.agreementPoints.map((pt, i) => (
                              <li key={i} className="flex items-start space-x-2 space-x-reverse">
                                <span className="w-4 h-4 rounded-full bg-emerald-200 text-emerald-800 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                                  ✓
                                </span>
                                <span className="font-medium">{pt}</span>
                              </li>
                            ))
                          ) : (
                            <li className="text-slate-500 text-xs">لا توجد نقاط اتفاق قاطعة مسجلة.</li>
                          )}
                          {reasoning.activeIngredientMatch.status === 'MATCHED' && (
                            <li className="flex items-start space-x-2 space-x-reverse font-bold text-emerald-900">
                              <span className="w-4 h-4 rounded-full bg-emerald-200 text-emerald-800 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                                ✓
                              </span>
                              <span>{reasoning.activeIngredientMatch.details}</span>
                            </li>
                          )}
                        </ul>
                      </div>

                      {/* Difference Points Card */}
                      <div className="bg-amber-50/80 p-4 rounded-xl border border-amber-200 shadow-2xs">
                        <div className="text-xs font-bold text-amber-950 mb-2.5 flex items-center space-x-1.5 space-x-reverse border-b border-amber-200/80 pb-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                          <span>قائمة أوجه الاختلاف والتحفظات (Difference Points):</span>
                        </div>
                        <ul className="space-y-2 text-xs text-amber-950">
                          {cand.differencePoints.length > 0 ? (
                            cand.differencePoints.map((pt, i) => (
                              <li key={i} className="flex items-start space-x-2 space-x-reverse">
                                <span className="w-4 h-4 rounded-full bg-amber-200 text-amber-800 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                                  •
                                </span>
                                <span className="font-medium">{pt}</span>
                              </li>
                            ))
                          ) : (
                            <li className="text-emerald-700 font-medium text-xs flex items-center space-x-1 space-x-reverse">
                              <Check className="w-3.5 h-3.5 text-emerald-600 ml-1" />
                              <span>تطابق متكامل بدون أي اختلافات جوهرية!</span>
                            </li>
                          )}
                          {priceDiff !== 0 && (
                            <li className="flex items-start space-x-2 space-x-reverse font-mono text-[11px] text-slate-700">
                              <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                                ₺
                              </span>
                              <span>
                                فارق السعر: {priceDiff > 0 ? `+${priceDiff.toFixed(2)}` : priceDiff.toFixed(2)} {currency}{' '}
                                {priceDiff > 0 ? '(سعر المورد أعلى من النظام)' : '(سعر المورد أقل من النظام)'}
                              </span>
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>

                    {/* 3. TOKEN & INGREDIENT DEEP ANALYSIS INSPECTION */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                      <div className="text-xs font-bold text-slate-800 flex items-center space-x-1.5 space-x-reverse">
                        <Layers className="w-4 h-4 text-emerald-600" />
                        <span>تحليل المفردات والرموز الدوائية (Token & Active Ingredient Breakdown):</span>
                      </div>

                      {/* Matching vs Divergent Tokens */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <span className="font-bold text-slate-800 block mb-1.5 text-[11px]">
                            المفردات المتطابقة في الاسمين (Matching Tokens):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {reasoning.matchingTokens.length > 0 ? (
                              reasoning.matchingTokens.map((tok, i) => (
                                <span
                                  key={i}
                                  className="bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded border border-emerald-300 text-[11px]"
                                >
                                  ✓ {tok}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 text-[11px]">لا توجد مفردات متطابقة حرفياً</span>
                            )}
                          </div>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <span className="font-bold text-slate-800 block mb-1.5 text-[11px]">
                            مفردات الفاتورة غير الموجودة بالصنف (Divergent Tokens):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {reasoning.unmatchedSupplierTokens.length > 0 ? (
                              reasoning.unmatchedSupplierTokens.map((tok, i) => (
                                <span
                                  key={i}
                                  className="bg-slate-200 text-slate-800 font-mono px-2 py-0.5 rounded border border-slate-300 text-[11px]"
                                >
                                  • {tok}
                                </span>
                              ))
                            ) : (
                              <span className="text-emerald-700 text-[11px] font-medium">
                                جميع مفردات سطر الفاتورة مشمولة في بطاقة الصنف الرسمي
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Clinical Attribute Check Table */}
                      <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                        <table className="w-full text-right divide-y divide-slate-200">
                          <thead className="bg-slate-100 font-bold text-slate-700 text-[11px]">
                            <tr>
                              <th className="p-2.5 w-36">العنصر السريري</th>
                              <th className="p-2.5">نتيجة التحليل والمقارنة</th>
                              <th className="p-2.5 w-24 text-center">حالة الفحص</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white text-[11px]">
                            <tr>
                              <td className="p-2.5 font-bold text-slate-800">المادة الفعالة:</td>
                              <td className="p-2.5 text-slate-700">{reasoning.activeIngredientMatch.text}</td>
                              <td className="p-2.5 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded font-bold ${
                                    reasoning.activeIngredientMatch.status === 'MATCHED'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : reasoning.activeIngredientMatch.status === 'COMPATIBLE'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {reasoning.activeIngredientMatch.status === 'MATCHED'
                                    ? 'مطابق'
                                    : reasoning.activeIngredientMatch.status === 'COMPATIBLE'
                                    ? 'متوافق'
                                    : 'غير مسجل'}
                                </span>
                              </td>
                            </tr>
                            <tr>
                              <td className="p-2.5 font-bold text-slate-800">التركيز والجرعة:</td>
                              <td className="p-2.5 text-slate-700">{reasoning.strengthAnalysis.text}</td>
                              <td className="p-2.5 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded font-bold ${
                                    reasoning.strengthAnalysis.status === 'EXACT' ||
                                    reasoning.strengthAnalysis.status === 'EQUIVALENT'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : reasoning.strengthAnalysis.status === 'MISMATCH'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {reasoning.strengthAnalysis.status === 'EXACT' ||
                                  reasoning.strengthAnalysis.status === 'EQUIVALENT'
                                    ? 'مطابق'
                                    : reasoning.strengthAnalysis.status === 'MISMATCH'
                                    ? 'تعارض'
                                    : 'غير محدد'}
                                </span>
                              </td>
                            </tr>
                            <tr>
                              <td className="p-2.5 font-bold text-slate-800">الشكل الدوائي:</td>
                              <td className="p-2.5 text-slate-700">{reasoning.formAnalysis.text}</td>
                              <td className="p-2.5 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded font-bold ${
                                    reasoning.formAnalysis.status === 'EXACT'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : reasoning.formAnalysis.status === 'MISMATCH'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {reasoning.formAnalysis.status === 'EXACT' ? 'مطابق' : 'مختلف'}
                                </span>
                              </td>
                            </tr>
                            <tr>
                              <td className="p-2.5 font-bold text-slate-800">الشركة / الموزع:</td>
                              <td className="p-2.5 text-slate-700">{reasoning.companyAnalysis.text}</td>
                              <td className="p-2.5 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded font-bold ${
                                    reasoning.companyAnalysis.status === 'EXACT'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {reasoning.companyAnalysis.status === 'EXACT' ? 'مطابق' : 'مختلف'}
                                </span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()
          )}

          {/* 4. Manual Search Section with direct Focus */}
          <div className="border-t border-slate-200 pt-5">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-900">
                تعديل واختيار يدوي مباشر من كامل قاعدة الأصناف الرسمية:
              </label>
              {manualSearchQuery && (
                <button
                  onClick={() => setManualSearchQuery('')}
                  className="text-xs text-slate-400 hover:text-slate-600 font-medium cursor-pointer"
                >
                  مسح البحث
                </button>
              )}
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              <input
                ref={manualSearchInputRef}
                type="text"
                value={manualSearchQuery}
                onChange={e => setManualSearchQuery(e.target.value)}
                placeholder="ابحث بالاسم العربي، الإنجليزي، الباركود، أو المادة الفعالة..."
                className="w-full pr-10 pl-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 focus:bg-white transition"
              />
            </div>

            {filteredManualItems.length > 0 && (
              <div className="mt-2.5 border border-slate-200 rounded-xl max-h-52 overflow-y-auto divide-y divide-slate-100 bg-white shadow-xs">
                {filteredManualItems.map(item => (
                  <div
                    key={item.id}
                    className="p-3 flex items-center justify-between hover:bg-slate-50 text-xs transition"
                  >
                    <div>
                      <div className="font-bold text-slate-800 flex items-center space-x-2 space-x-reverse">
                        <span>{item.name}</span>
                        {item.nameAr && <span className="text-slate-500 font-normal">({item.nameAr})</span>}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        باركود: {item.barcode} | السعر: {item.price} {currency} | التركيز: {item.strength || '—'} | المادة الفعالة: {item.activeIngredient || '—'}
                      </div>
                    </div>
                    <button
                      onClick={() => handleAcceptManual(item)}
                      className="bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      اعتماد هذا الصنف
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 5. Auto Learn Toggle */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2 space-x-reverse">
              <BookmarkPlus className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-semibold text-slate-800">
                التعلم من المطابقة اليدوية
              </span>
            </div>
            <label className="flex items-center cursor-pointer space-x-2 space-x-reverse text-xs text-slate-600">
              <input
                type="checkbox"
                checked={saveToDict}
                onChange={e => setSaveToDict(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
              />
              <span>حفظ هذا الربط في قاموس الصيدلية للمطابقة الآلية التلقائية في الفواتير القادمة</span>
            </label>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="bg-slate-100 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2 space-x-reverse">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="p-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition text-xs font-medium flex items-center cursor-pointer"
            >
              <ChevronRight className="w-4 h-4 ml-1" />
              <span>السابق</span>
            </button>
            <span className="text-xs text-slate-500 font-mono">
              {currentIndex + 1} / {totalToReview}
            </span>
            <button
              onClick={handleNext}
              disabled={currentIndex >= totalToReview - 1}
              className="p-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition text-xs font-medium flex items-center cursor-pointer"
            >
              <span>التالي</span>
              <ChevronLeft className="w-4 h-4 mr-1" />
            </button>
          </div>

          <div className="flex items-center space-x-2 space-x-reverse">
            <button
              onClick={handleOpenAddProductDialog}
              className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition flex items-center cursor-pointer shadow-xs"
              title="إضافة الصنف مباشرة لقاعدة البيانات واعتماده"
            >
              <PlusCircle className="w-4 h-4 ml-1.5" />
              <span>إضافة كصنف جديد للنظام</span>
            </button>
            <button
              onClick={handleMarkUnmatched}
              className="px-3.5 py-2 rounded-xl border border-red-300 text-red-700 hover:bg-red-50 text-xs font-bold transition cursor-pointer"
            >
              تعليم كصنف غير موجود
            </button>
            <button
              onClick={handleNext}
              className="px-4 py-2 rounded-xl bg-slate-800 text-white hover:bg-slate-900 text-xs font-bold transition flex items-center cursor-pointer"
            >
              <span>تخطي مؤقتاً</span>
              <ArrowRight className="w-4 h-4 mr-1" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Add Product to Database Dialog */}
      {isAddProductOpen && (
        <div className="fixed inset-0 z-60 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2 space-x-reverse">
                <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                  +
                </div>
                <h3 className="font-bold text-slate-900 text-sm">
                  إضافة صنف جديد لقاعدة الأصناف الرسمية
                </h3>
              </div>
              <button
                onClick={() => setIsAddProductOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              هذا الصنف غير مسجل في قاعدة البيانات. يمكنك إضافته وتعيين الباركود والسعر والشكل الصيدلاني فوراً وربطه بسطر الفاتورة.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  اسم الصنف الرسمي *:
                </label>
                <input
                  type="text"
                  value={newProdName}
                  onChange={e => setNewProdName(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    الباركود *:
                  </label>
                  <input
                    type="text"
                    value={newProdBarcode}
                    onChange={e => setNewProdBarcode(e.target.value)}
                    className="w-full font-mono border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    السعر الرسمي ({currency}):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newProdPrice}
                    onChange={e => setNewProdPrice(parseFloat(e.target.value) || 0)}
                    className="w-full font-mono border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    الشكل الصيدلاني:
                  </label>
                  <input
                    type="text"
                    value={newProdForm}
                    onChange={e => setNewProdForm(e.target.value)}
                    placeholder="مثال: اقراص، كبسول، فوار"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    التركيز (اختياري):
                  </label>
                  <input
                    type="text"
                    value={newProdStrength}
                    onChange={e => setNewProdStrength(e.target.value)}
                    placeholder="مثال: 500mg, 1000mg"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end space-x-2 space-x-reverse pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAddProductOpen(false)}
                className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveAndConfirmNewProduct}
                disabled={!newProdName.trim()}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                حفظ وإضافة واعتماد الصنف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
