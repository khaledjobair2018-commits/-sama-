import React, { useState, useMemo } from 'react';
import {
  FlaskConical,
  Play,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Sparkles,
  Zap,
  ArrowRight,
  ShieldCheck,
  Building2,
  Pill,
  Package,
} from 'lucide-react';
import { runAllTests, TestCaseResult } from '../services/testSuite';
import { PharmacyMatchEngine } from '../services/matcher';
import { SEED_MASTER_ITEMS } from '../services/storage';
import { extractPharmaEntity } from '../services/extractor';

export const TestsView: React.FC = () => {
  const [testResults, setTestResults] = useState<TestCaseResult[]>(() => runAllTests().results);
  const [isRunning, setIsRunning] = useState(false);

  // Live Sandbox state
  const [sandboxInput, setSandboxInput] = useState('لينوبريل أقراص 10 ملغرام الجنتين');
  const [sandboxBarcode, setSandboxBarcode] = useState('');

  const engine = useMemo(() => {
    return new PharmacyMatchEngine(SEED_MASTER_ITEMS, [], {
      highConfidenceThreshold: 85,
      reviewThreshold: 65,
    });
  }, []);

  // Sandbox Live Calculation
  const sandboxExtracted = useMemo(() => {
    return extractPharmaEntity(sandboxInput);
  }, [sandboxInput]);

  const sandboxResult = useMemo(() => {
    if (!sandboxInput.trim()) return null;
    return engine.matchLine({
      rowNumber: 1,
      rawSupplierName: sandboxInput,
      quantity: 1,
      unitPrice: 20,
      supplierBarcode: sandboxBarcode.trim() || undefined,
    });
  }, [engine, sandboxInput, sandboxBarcode]);

  const handleRunTests = () => {
    setIsRunning(true);
    setTimeout(() => {
      const suite = runAllTests();
      setTestResults(suite.results);
      setIsRunning(false);
    }, 250);
  };

  const totalPassed = testResults.filter(t => t.passed).length;
  const totalFailed = testResults.filter(t => !t.passed).length;
  const allPassed = totalFailed === 0;

  const realLifeTests = testResults.filter(t => t.category === 'REAL_LIFE_MANDATORY');
  const dangerousTests = testResults.filter(t => t.category === 'CRITICAL_SAFETY');
  const otherTests = testResults.filter(
    t => t.category !== 'CRITICAL_SAFETY' && t.category !== 'REAL_LIFE_MANDATORY'
  );

  const presetQueries = [
    { label: 'مثال 1: لينوبريل الجنتين', text: 'لينوبريل أقراص 10 ملغرام الجنتين' },
    { label: 'مثال 2: سوبرانيل الفتحة', text: 'سوبرانيل 25 ملغرام كبسول 20 ك الفتحة' },
    { label: 'مثال 3: دكلو دنك ريتارد', text: 'دكلو دنك ريتارد 100 مجم 10*10' },
    { label: 'مثال 4: كونكور 5 مجم', text: 'كونكور 5 مجم أقراص' },
    { label: 'خطر: أموكسيسيلين 250 مقابل 500', text: 'Amoxicillin 250mg Capsule' },
    { label: 'خطر: فيتامين د3 50 ألف', text: 'Vitamin D3 50000 IU Caps' },
    { label: 'همزات: اوجمنتين 1 جم', text: 'اوجمنتين 1 جم اقراص' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 space-x-reverse mb-1">
            <FlaskConical className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900">
              مختبر واختبارات محرك المطابقة الذكي (Match Engine V2)
            </h2>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            محرك مطابقة صيدلاني صارم متعدد المراحل (تفكيك الكيانات، استخراج التركيز والوحدة والشكل
            والعبوة، فحص التعارضات السريرية، وقواعد منع الخلط القاتل للجرعات).
          </p>
        </div>

        <button
          onClick={handleRunTests}
          disabled={isRunning}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-md shadow-emerald-700/20 transition flex items-center space-x-2 space-x-reverse self-start sm:self-auto cursor-pointer"
        >
          <Play className="w-4 h-4 fill-white" />
          <span>{isRunning ? 'جاري الفحص...' : 'إعادة تشغيل جميع الاختبارات'}</span>
        </button>
      </div>

      {/* Summary Scorecards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          className={`p-4 rounded-xl border shadow-xs ${
            allPassed ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
          }`}
        >
          <div className="text-xs font-semibold text-slate-600 mb-1">الحالة الإجمالية للاختبارات</div>
          <div
            className={`text-xl font-black ${
              allPassed ? 'text-emerald-700' : 'text-red-700'
            } flex items-center`}
          >
            {allPassed ? (
              <>
                <CheckCircle2 className="w-5 h-5 ml-1.5" />
                <span>اجتياز بنسبة 100% (أمان تام)</span>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 ml-1.5" />
                <span>يوجد {totalFailed} اختبار غير مجتاز</span>
              </>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 mb-1">اختبارات الأمثلة الإلزامية</div>
          <div className="text-2xl font-black text-emerald-600 font-mono">
            {realLifeTests.filter(t => t.passed).length} / {realLifeTests.length}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 mb-1">اختبارات الأمان الحرجة (الجرعات)</div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {dangerousTests.filter(t => t.passed).length} / {dangerousTests.length}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* LIVE INTERACTIVE MATCH ENGINE SANDBOX */}
      {/* ============================================================ */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-xl border border-slate-700">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-700">
          <div className="flex items-center space-x-2 space-x-reverse">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">مختبر التجربة الحية لمحرك المطابقة (Live Sandbox)</h3>
              <p className="text-xs text-slate-400">
                اكتب أي اسم صنف من فاتورة مورد ولاحظ كيف يفكك المحرك الكيانات ويطبق القواعد في الوقت الفعلي
              </p>
            </div>
          </div>
        </div>

        {/* Preset quick test chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-xs text-slate-400 self-center ml-2">أمثلة سريعة:</span>
          {presetQueries.map((q, idx) => (
            <button
              key={idx}
              onClick={() => {
                setSandboxInput(q.text);
                setSandboxBarcode('');
              }}
              className="text-xs px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-emerald-600/80 hover:text-white transition text-slate-200 border border-slate-600 cursor-pointer"
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1">
              اسم الصنف كما هو مكتوب في فاتورة المورد:
            </label>
            <input
              type="text"
              value={sandboxInput}
              onChange={e => setSandboxInput(e.target.value)}
              placeholder="مثال: لينوبريل أقراص 10 ملغرام الجنتين..."
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              الباركود من الفاتورة (اختياري):
            </label>
            <input
              type="text"
              value={sandboxBarcode}
              onChange={e => setSandboxBarcode(e.target.value)}
              placeholder="6281..."
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Entity Decomposition breakdown */}
        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 mb-4">
          <div className="text-xs font-bold text-slate-400 mb-2 flex items-center space-x-1.5 space-x-reverse">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>التفكيك السريري للنص المدخل (Clinical Entity Decomposition):</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
            <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-700">
              <span className="text-slate-400 block text-[10px]">الاسم التجاري:</span>
              <span className="font-bold text-emerald-400 truncate block">
                {sandboxExtracted.coreName || '—'}
              </span>
            </div>
            <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-700">
              <span className="text-slate-400 block text-[10px]">التركيز والوحدة:</span>
              <span className="font-bold text-blue-400">
                {sandboxExtracted.strengthRaw ||
                  (sandboxExtracted.strengthValue ? `${sandboxExtracted.strengthValue} ${sandboxExtracted.strengthUnit || ''}` : '—')}
              </span>
            </div>
            <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-700">
              <span className="text-slate-400 block text-[10px]">الشكل الدوائي:</span>
              <span className="font-bold text-purple-400">
                {sandboxExtracted.dosageFormLabel || sandboxExtracted.dosageForm || '—'}
              </span>
            </div>
            <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-700">
              <span className="text-slate-400 block text-[10px]">حجم العبوة:</span>
              <span className="font-bold text-amber-400 font-mono">
                {sandboxExtracted.packRaw || '—'}
              </span>
            </div>
            <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-700">
              <span className="text-slate-400 block text-[10px]">الشركة / الموزع:</span>
              <span className="font-bold text-cyan-400">
                {sandboxExtracted.company || '—'}
              </span>
            </div>
            <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-700">
              <span className="text-slate-400 block text-[10px]">المحددات:</span>
              <span className="font-bold text-pink-400">
                {sandboxExtracted.descriptors.length > 0
                  ? sandboxExtracted.descriptors.join(', ')
                  : 'عادي'}
              </span>
            </div>
          </div>
        </div>

        {/* Live Matching Engine Decision */}
        {sandboxResult && (
          <div className="bg-slate-900/90 rounded-xl p-4 border border-slate-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2 space-x-reverse">
                <span className="text-xs text-slate-400">قرار المحرك:</span>
                <span
                  className={`text-xs px-2.5 py-1 rounded-md font-bold font-mono ${
                    sandboxResult.status === 'MATCHED'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : sandboxResult.status === 'REVIEW_REQUIRED'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-red-500/20 text-red-300 border border-red-500/30'
                  }`}
                >
                  {sandboxResult.status === 'MATCHED'
                    ? 'مطابقة مؤكدة (MATCHED)'
                    : sandboxResult.status === 'REVIEW_REQUIRED'
                    ? 'يحتاج مراجعة (REVIEW_REQUIRED)'
                    : 'غير مطابق (UNMATCHED)'}
                </span>
                <span className="text-xs text-slate-400">
                  درجة الثقة:{' '}
                  <strong className="text-white font-mono">{sandboxResult.confidenceScore}%</strong>
                </span>
              </div>

              {sandboxResult.matchedItem && (
                <div className="text-xs text-slate-300 font-mono">
                  سعر النظام: {sandboxResult.matchedItem.price} ر.س | باركود:{' '}
                  {sandboxResult.matchedItem.barcode}
                </div>
              )}
            </div>

            {/* Top Match Result Details */}
            {sandboxResult.matchedItem ? (
              <div className="bg-slate-800/90 p-3 rounded-lg border border-slate-700 mb-3">
                <div className="flex items-center space-x-2 space-x-reverse mb-1">
                  <span className="text-emerald-400 font-bold text-sm">
                    {sandboxResult.matchedItem.name}
                  </span>
                  {sandboxResult.matchedItem.nameAr && (
                    <span className="text-xs text-slate-400">
                      ({sandboxResult.matchedItem.nameAr})
                    </span>
                  )}
                </div>

                {sandboxResult.candidates[0] && (
                  <div className="space-y-2 mt-2">
                    {/* Agreement points */}
                    {sandboxResult.candidates[0].agreementPoints.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 text-[11px]">
                        <span className="text-slate-400">نقاط الاتفاق:</span>
                        {sandboxResult.candidates[0].agreementPoints.map((pt, i) => (
                          <span
                            key={i}
                            className="bg-emerald-900/40 text-emerald-300 px-2 py-0.5 rounded border border-emerald-700/50"
                          >
                            ✓ {pt}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Hard rule violations if any */}
                    {sandboxResult.candidates[0].hardRuleViolations.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 text-[11px]">
                        <span className="text-red-400 font-bold">تعارضات سريرية:</span>
                        {sandboxResult.candidates[0].hardRuleViolations.map((v, i) => (
                          <span
                            key={i}
                            className="bg-red-900/40 text-red-300 px-2 py-0.5 rounded border border-red-700/50 font-bold"
                          >
                            ⚠ {v}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Score Breakdown pill */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-slate-700/80 text-[11px]">
                      <div>
                        <span className="text-slate-400 block">اسم الصنف (35%):</span>
                        <span className="font-mono text-emerald-400 font-bold">
                          {sandboxResult.candidates[0].scoreBreakdown.coreNameScore}%
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">التركيز (25%):</span>
                        <span className="font-mono text-blue-400 font-bold">
                          {sandboxResult.candidates[0].scoreBreakdown.strengthScore}%
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">الشكل (15%):</span>
                        <span className="font-mono text-purple-400 font-bold">
                          {sandboxResult.candidates[0].scoreBreakdown.formScore}%
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">العبوة (10%):</span>
                        <span className="font-mono text-amber-400 font-bold">
                          {sandboxResult.candidates[0].scoreBreakdown.packScore}%
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">الشركة (10%):</span>
                        <span className="font-mono text-cyan-400 font-bold">
                          {sandboxResult.candidates[0].scoreBreakdown.companyScore}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 text-center text-xs text-slate-400">
                لم يتم إيجاد صنف مطابق بدرجة كافية في قاعدة البيانات.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* SECTION 1: MANDATORY REAL-LIFE USER TEST CASES */}
      {/* ============================================================ */}
      <div>
        <div className="flex items-center space-x-2 space-x-reverse mb-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <h3 className="text-sm font-black text-slate-900">
            الأمثلة الحقيقية الإلزامية المطلوبة في مواصفات المشروع
          </h3>
        </div>

        <div className="space-y-3">
          {realLifeTests.map(test => (
            <div
              key={test.id}
              className={`p-4 rounded-xl border bg-white shadow-xs ${
                test.passed ? 'border-emerald-200' : 'border-red-300 bg-red-50'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center space-x-2 space-x-reverse">
                  {test.passed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  )}
                  <span className="font-bold text-slate-900 text-xs sm:text-sm">{test.title}</span>
                </div>

                <div className="flex items-center space-x-2 space-x-reverse text-xs font-mono">
                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                    مدخل المورد: "{test.supplierInput}"
                  </span>
                  <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                    الحالة: {test.actualStatus} ({test.confidenceScore}%)
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-700 ml-1">السلوك المطلوب:</span>
                    <span>{test.expectedBehavior}</span>
                  </div>
                  {test.matchedMasterName && (
                    <div className="font-bold text-emerald-700">
                      الصنف المطابق: {test.matchedMasterName}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION 2: CRITICAL CLINICAL SAFETY TESTS */}
      {/* ============================================================ */}
      <div>
        <div className="flex items-center space-x-2 space-x-reverse mb-3">
          <ShieldAlert className="w-5 h-5 text-red-600" />
          <h3 className="text-sm font-black text-slate-900">
            اختبارات السلامة الدوائية الأخطر (التحقق الصارم من عدم خلط الجرعات والتركيزات)
          </h3>
        </div>

        <div className="space-y-3">
          {dangerousTests.map(test => (
            <div
              key={test.id}
              className={`p-4 rounded-xl border bg-white shadow-xs ${
                test.passed ? 'border-slate-200' : 'border-red-300 bg-red-50'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center space-x-2 space-x-reverse">
                  {test.passed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  )}
                  <span className="font-bold text-slate-900 text-xs sm:text-sm">{test.title}</span>
                </div>

                <div className="flex items-center space-x-2 space-x-reverse text-xs font-mono">
                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                    "{test.supplierInput}"
                  </span>
                  <span className="bg-slate-800 text-white font-bold px-2 py-0.5 rounded">
                    {test.actualStatus}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="font-bold text-slate-700 block mb-0.5">القاعدة السريرية:</span>
                <span>{test.expectedBehavior}</span>
                {test.notes && (
                  <div className="text-slate-500 mt-1 font-mono text-[11px]">
                    ملاحظة المحرك: {test.notes}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION 3: NORMALIZATION, FORMS, AND BARCODE */}
      {/* ============================================================ */}
      <div>
        <div className="flex items-center space-x-2 space-x-reverse mb-3">
          <Sparkles className="w-5 h-5 text-emerald-600" />
          <h3 className="text-sm font-black text-slate-900">
            اختبارات تطبيع النصوص، الأشكال الدوائية والباركود
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {otherTests.map(test => (
            <div
              key={test.id}
              className={`p-3 rounded-xl border bg-white shadow-xs ${
                test.passed ? 'border-slate-200' : 'border-red-300 bg-red-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center space-x-1.5 space-x-reverse">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span className="font-bold text-slate-900 text-xs">{test.title}</span>
                </div>
                <span className="text-[11px] font-mono text-emerald-700 font-bold">
                  {test.confidenceScore}%
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                "{test.supplierInput}" → {test.matchedMasterName || test.actualStatus}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
